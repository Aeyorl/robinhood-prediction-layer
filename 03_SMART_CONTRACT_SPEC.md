# 03 — Smart Contract Specification

## 1. Design objectives

The v0 contract system should be intentionally small.

Priorities:

1. fully collateralized,
2. no admin ability to seize user principal,
3. deterministic payout math,
4. objective oracle resolution,
5. pull-based claims/refunds,
6. bounded/configurable fees,
7. emergency pause for new risk-taking while preserving exits/claims,
8. isolated markets where practical,
9. strong events for indexing.

## 2. Contract set

Recommended v0:

```text
MarketFactory.sol
BinaryPoolMarket.sol
OracleRegistry.sol
ChainlinkPriceResolver.sol
DataStreamsRwaResolver.sol
FeeVault.sol
interfaces/
  IMarketFactory.sol
  IBinaryPoolMarket.sol
  IOracleRegistry.sol
  IPriceResolver.sol
libraries/
  MarketTypes.sol
mocks/
  MockUSDG.sol
  MockERC20.sol
  MockAggregatorV3.sol
  MockSequencerFeed.sol
  MockSwapAdapter.sol
```

Do not put swapping inside `BinaryPoolMarket` in v0. Keep prediction collateral accounting separate from DEX execution.

## 3. MarketFactory

### Responsibilities

- create new `BinaryPoolMarket` instances/clones,
- enforce authorized market creators in v0,
- maintain registry of created markets,
- enforce global fee bounds,
- optionally enforce allowed collateral token,
- emit canonical market-created event.

### Suggested roles

- `DEFAULT_ADMIN_ROLE`
- `MARKET_CREATOR_ROLE`
- `PAUSER_ROLE`

Mainnet admin should ultimately be a multisig, not a single hot wallet.

### Suggested create params

```solidity
struct CreateMarketParams {
    bytes32 externalId;
    address collateralToken;
    bytes32 oracleAssetId;
    address resolver;
    uint8 comparator;
    int256 strike;
    uint8 strikeDecimals;
    uint64 openTime;
    uint64 lockTime;
    uint64 resolutionTime;
    uint64 resolutionGracePeriod;
    uint16 feeBps;
    uint256 minEntry;
    uint256 maxEntry;
    bytes32 metadataHash;
}
```

`metadataHash` can commit to normalized offchain JSON containing question/description/terms, but critical resolution parameters must always be onchain.

## 4. BinaryPoolMarket state

```solidity
enum Outcome { NONE, YES, NO }
enum Status { OPEN, LOCKED, RESOLVED, CANCELLED }

IERC20 public immutable collateral;
IPriceResolver public immutable resolver;
bytes32 public immutable oracleAssetId;
uint8 public immutable comparator;
int256 public immutable strike;
uint8 public immutable strikeDecimals;
uint64 public immutable openTime;
uint64 public immutable lockTime;
uint64 public immutable resolutionTime;
uint64 public immutable resolutionGracePeriod;
uint16 public immutable feeBps;
uint256 public immutable minEntry;
uint256 public immutable maxEntry;

Status public status;
Outcome public winningOutcome;
int256 public resolvedPrice;
uint64 public resolvedAt;

uint256 public yesPool;
uint256 public noPool;
uint256 public accruedFees;

mapping(address => uint256) public yesStake;
mapping(address => uint256) public noStake;
mapping(address => bool) public claimed;
mapping(address => bool) public refunded;
```

If clones prevent Solidity immutables, use initialize-once storage with initializer guard. Do not leave reinitialization possible.

## 5. Entry function

Suggested behavior:

```solidity
function enter(Outcome outcome, uint256 amount) external nonReentrant whenEntriesNotPaused;
```

Requirements:

- `block.timestamp >= openTime`,
- `block.timestamp < lockTime`,
- market status OPEN,
- outcome is YES or NO,
- amount >= minEntry,
- amount <= maxEntry if maxEntry > 0,
- `safeTransferFrom(msg.sender, address(this), amount)`,
- update user stake and pool,
- emit event after state update.

Measure the actual balance increase and require it to equal `amount`. This rejects fee-on-transfer, rebasing, or otherwise non-standard collateral behavior even if an incorrect token is configured.

### Event

```solidity
event PositionEntered(
    address indexed user,
    Outcome indexed outcome,
    uint256 amount,
    uint256 newYesPool,
    uint256 newNoPool
);
```

## 6. Locking

Lock can be implicit from timestamp even before an explicit `lock()` call.

All entry functions must enforce `block.timestamp < lockTime` regardless of stored status.

Optional permissionless function:

```solidity
function syncStatus() external;
```

which marks OPEN → LOCKED after `lockTime` for indexing/UI convenience.

Never allow a delayed lock transaction to extend the market.

## 7. Resolver interface

```solidity
interface IOracleResolver {
    function resolve(
        bytes32 oracleAssetId,
        uint256 targetTime,
        bytes calldata proof
    ) external returns (int256 price, uint8 decimals);
}
```

Push-feed resolvers require an empty proof. Pull-based production resolvers verify the supplied signed report before returning a value. `BinaryPoolMarket.resolve()` is the no-proof convenience overload; `resolve(bytes)` is used for Data Streams.

## 8. Resolution rule

`resolve()` / `resolve(bytes)` requirements:

- `block.timestamp >= resolutionTime`,
- market not already resolved/cancelled,
- oracle returns valid positive price,
- observation is within allowed resolution window,
- normalize strike/oracle decimals safely,
- evaluate comparator,
- set winner exactly once,
- store resolved price and timestamp,
- emit MarketResolved.

Suggested comparators:

```text
0 = GREATER_THAN
1 = GREATER_THAN_OR_EQUAL
2 = LESS_THAN
3 = LESS_THAN_OR_EQUAL
```

Do not encode equality policy only in UI copy.

## 9. Oracle validity checks

`ChainlinkPriceResolver` should:

- resolve registered feed address from frozen/snapshotted config,
- call `latestRoundData()`,
- require answer > 0,
- require updatedAt > 0,
- compare `block.timestamp - updatedAt` against configured heartbeat/staleness,
- check L2 sequencer uptime and grace period,
- optionally query Stock Token `oraclePaused()` when configured,
- return invalid rather than silently using stale data.

For scheduled-time production equity resolution, `DataStreamsRwaResolver` verifies the unmodified RWA Advanced v11 payload through the official verifier proxy and enforces the configured feed ID, report validity interval around `resolutionTime`, report expiry, expected market status, positive mid price, and a bounded distance between the last-seen price timestamp and `resolutionTime`.

## 10. Cancel/refund policy

A market can become refundable when:

- oracle remains invalid past `resolutionTime + resolutionGracePeriod`,
- authorized emergency cancellation occurs under clearly defined conditions,
- winning side has zero stake,
- protocol detects an unrecoverable market configuration error before resolution.

Cancellation must not transfer user principal to treasury.

`cancel()` should be tightly permissioned or permissionless only under deterministic timeout conditions.

`refund()`:

- only when CANCELLED,
- user refund = yesStake + noStake,
- set refunded before transfer,
- use SafeERC20,
- no cancellation fee.

## 11. Claim accounting

For a resolved market:

```text
winningPool = yesPool or noPool
losingPool = opposite pool
userWinningStake = user stake on winner
```

If `userWinningStake == 0`, claim returns/reverts with no claimable balance.

Gross payout:

```text
gross = userWinningStake * (winningPool + losingPool) / winningPool
```

Profit:

```text
profit = gross - userWinningStake
```

Fee:

```text
fee = profit * feeBps / 10_000
```

Net:

```text
net = gross - fee
```

Rounding should favor contract solvency. The final dust amount after all claims can be swept only after a long claim period and with explicit policy; do not create a mechanism that can sweep still-claimable principal.

## 12. FeeVault

Do not immediately forward fees during user claim if that increases external-call complexity.

Options:

- accrue fees in each market and allow factory/treasury to collect after claims, or
- transfer fee to a simple FeeVault after claim state is updated.

Fee cap example:

```text
MAX_FEE_BPS = 300
```

Set testnet default to 0.

## 13. Pause semantics

Global or market pause should block:

- new entries,
- unsafe admin mutations.

Pause should **not** block:

- valid winner claims,
- valid cancellation refunds.

A pause mechanism that traps already-deposited funds is unacceptable.

## 14. Upgradeability

Preferred v0:

- non-upgradeable market instances,
- versioned factory implementations,
- new versions create new markets,
- old markets retain original code.

If proxy upgradeability is used, it must be justified, timelocked, and subject to storage-layout tests. Simplicity is preferred.

## 15. Source funding-token metadata

The core market contract should care only about USDG.

Do not add arbitrary meme-token logic into settlement.

If a later `PredictionEntryRouter` performs the swap, emit:

```solidity
event EnteredWithFundingToken(
    address indexed user,
    address indexed market,
    address indexed fundingToken,
    uint256 fundingAmount,
    uint256 collateralAmount,
    Outcome outcome
);
```

This gives community analytics an onchain-authenticated source-token dimension.

If v0 uses two separate transactions, source-token analytics may initially be offchain/correlated and should be labelled accordingly.

## 16. PredictionEntryRouter — later hardened design

Pseudo-interface:

```solidity
function enterWithToken(
    address market,
    uint8 outcome,
    address inputToken,
    uint256 inputAmount,
    uint256 minCollateralOut,
    uint256 deadline,
    bytes calldata approvedSwapData
) external;
```

Security conditions:

- only one allowlisted swap execution target,
- output token hardcoded/configured to USDG,
- verify market came from factory,
- verify deadline,
- verify actual collateral delta >= minCollateralOut,
- reset token allowance when practical,
- no residual user token retained,
- refund residual source token,
- no arbitrary recipient,
- no arbitrary call target encoded by user,
- reentrancy guard,
- pause,
- slippage bound,
- emit exact actual amounts.

Do not ship this contract unaudited simply to reduce the UX from two transactions to one.

## 17. Events

Minimum event set:

```solidity
event MarketCreated(...);
event PositionEntered(...);
event MarketLocked(...);
event MarketResolved(...);
event MarketCancelled(...);
event Claimed(address indexed user, uint256 gross, uint256 fee, uint256 net);
event Refunded(address indexed user, uint256 amount);
event FeesWithdrawn(address indexed recipient, uint256 amount);
```

Include enough immutable market parameters in `MarketCreated` for a fresh indexer to rebuild state.

## 18. Contract invariants

At all times before fee withdrawal:

1. Contract collateral balance must be sufficient for all unclaimed/refundable obligations plus accrued fees.
2. A user cannot claim twice.
3. A user cannot refund twice.
4. A resolved market cannot be cancelled.
5. A cancelled market cannot be resolved.
6. Entries cannot occur at/after lock time.
7. Resolution cannot occur before resolution time.
8. Winning outcome cannot change after resolution.
9. `feeBps <= MAX_FEE_BPS`.
10. No admin path can arbitrarily withdraw participant principal.

## 19. Foundry test groups

### Unit tests

- create market with valid params,
- reject invalid times,
- reject invalid comparator,
- reject fee over cap,
- enter YES,
- enter NO,
- reject before open,
- reject after lock,
- min/max entry,
- resolve every comparator,
- reject stale/negative oracle,
- cancellation timeout,
- claim math,
- fee on profit only,
- refund math,
- double-claim prevention,
- double-refund prevention.

### Fuzz tests

Fuzz:

- number of users,
- deposits,
- pool imbalance,
- fees,
- strike/oracle decimals,
- timestamps within valid bounds.

### Invariant tests

- total paid + remaining obligations + fees never exceed deposited collateral,
- claims never produce negative solvency,
- state machine cannot regress.

### Fork tests

On Robinhood Chain mainnet fork:

- canonical USDG behavior,
- Chainlink feed reads for a configured Stock Token,
- sequencer feed behavior,
- Uniswap quote/transaction path outside protocol core.

## 20. Deployment sequence

1. Deploy mocks locally.
2. Deploy OracleRegistry.
3. Configure test oracle assets.
4. Deploy FeeVault.
5. Deploy BinaryPoolMarket implementation if clones used.
6. Deploy MarketFactory.
7. Grant roles.
8. Renounce unnecessary deployer roles only after multisig/control is confirmed.
9. Create a small test market.
10. Exercise entry → lock → resolve → claim.
11. Verify contracts on Blockscout.
12. Persist deployment JSON by chain ID and git commit.

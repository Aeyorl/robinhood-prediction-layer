# @pl/contracts — Foundry

Binary pooled parimutuel prediction markets for Robinhood Chain.

## Layout

```text
src/
  interfaces/   AggregatorV3Interface, IOracleResolver, IMarket
  market/       BinaryPoolMarket (core), MarketFactory (admin creation)
  oracle/       OracleRegistry, ChainlinkPriceResolver
  fee/          FeeVault
  mocks/        MockUSDG, MockERC20, MockAggregatorV3, MockSequencerFeed
test/           unit, fuzz, invariant, and vertical-slice tests
script/         DeployLocal.s.sol (local), Deploy.s.sol (gated production)
abi/            exported ABIs for the SDK (regenerate after contract changes)
deployments/    local deployment manifest (gitignored)
```

## Commands

```bash
forge build
forge test            # unit + fuzz + invariant
forge test -vvv       # verbose
forge coverage
forge fmt --check
forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
node scripts/export-abis.mjs   # after contract changes, regenerate abi/*.json
```

## Market mechanism (v0)

- Normalized collateral: USDG.
- YES pool and NO pool; entries until `lockTime` (the timestamp is checked
  directly, so a missing `lock()` transaction can never extend entry).
- No early exit in v0.
- Resolution: permissionless via a deterministic resolver at/after
  `resolutionTime`. Admin can never type a winning result.
- Winners share the full pool pro rata: `gross = stake * (yes+no)/winningPool`,
  fee (if enabled) is charged only on profit, floor rounding preserves
  solvency.
- Cancellation refunds principal. If the winning side has zero stake, the
  market cancels and refunds everyone.
- Strict comparison: equality between price and strike produces no winner and
  cancels/refunds (documented semantics).
- Default testnet fee = 0.

## Invariants

No double claim, no double refund, no entry after lock, no early resolution,
no outcome change after resolution, no cancellation after resolution, no admin
withdrawal of user principal, pause never blocks claims/refunds, fee <= hard
cap (10%), contract always solvent.

## Oracle notes

- Feed decimals are read dynamically (`feed.decimals()`), never assumed to be 8.
- Health checks: answer > 0, updatedAt > 0, staleness <= configured heartbeat,
  L2 sequencer uptime + grace period, stock-token `oraclePaused` state.
- Comparison between feed price and strike is normalized to a common decimal
  scale in `BinaryPoolMarket._evaluate`.
- A Chainlink Data Streams resolver interface slot exists (`IOracleResolver`)
  but verification is NOT faked — wire it up in a later milestone with the
  real verifier proxy.

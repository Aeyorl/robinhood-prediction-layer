# Contracts

Solidity 0.8.31, OpenZeppelin v5, Foundry. See `packages/contracts/README.md` for commands.

## Contracts

| Contract                                                         | Purpose                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `BinaryPoolMarket`                                               | Core pooled parimutuel market: enter, lock, resolve, claim, refund |
| `MarketFactory`                                                  | Admin-only creation of template markets with immutable terms       |
| `OracleRegistry`                                                 | Maps oracle asset key → feed, Stock Token, heartbeat, sequencer    |
| `ChainlinkPriceResolver`                                         | Deterministic AggregatorV3 resolution with health checks           |
| `FeeVault`                                                       | Protocol fee sink; owner withdraws only to a fixed recipient       |
| `MockUSDG`, `MockERC20`, `MockAggregatorV3`, `MockSequencerFeed` | Local/test mocks (never mainnet)                                   |

## Market terms (immutable after creation)

Collateral, resolver, oracle asset key, comparator (`PRICE_ABOVE_AT_TIME` | `PRICE_BELOW_AT_TIME`), strike + strike decimals, open/lock/resolution times, grace period, fee bps (≤ 10% hard cap), min entry, optional per-user-per-side max entry, question, metadata URI, fee vault.

## State

- `status`: OPEN → LOCKED → RESOLVED | CANCELLED
- `yesPool`, `noPool`; per-user `userYesStake`, `userNoStake`
- `winningOutcome`, `resolvedPrice`, `resolvedAt`
- `hasClaimed[user]` — single flag preventing both double-claims and double-refunds

## Payout math

If YES wins:

```text
gross = userYesStake * (yesPool + noPool) / yesPool     (floor)
profit = gross - userYesStake
fee = profit * feeBps / 10_000                          (floor; only on profit)
net = gross - fee
```

Floor rounding preserves solvency: winners collectively receive ≤ the pool. Any dust (strictly less than the number of winners) remains in the contract. Symmetric for NO.

## Resolution

Permissionless — anyone may call `resolve()` at/after `resolutionTime` when the market is LOCKED. The resolver validates:

- asset is configured,
- L2 sequencer is up and its grace period has elapsed,
- latest answer > 0, `updatedAt` > 0, and the round is complete,
- timestamp is not in the future and the round is within the configured heartbeat,
- operator pause is clear and Stock Token `oraclePaused()` is readable and false.

Feed decimals are read dynamically via `decimals()` and the market compares price and strike on a common scale (`_evaluate`). Admin can never type the winning outcome.

Each factory-created market snapshots the resolver configuration hash. Feed-term changes block resolution for that market instead of silently changing its terms. Admin cancellation refunds principal. Once `resolutionTime + gracePeriod` passes, anyone can cancel an oracle-unhealthy market and unlock refunds; this path rejects a healthy oracle. If the winning side has zero stake, or the price equals the strike, resolution itself cancels and refunds.

## Events (indexed by the worker)

`MarketCreated` (factory), `PositionEntered`, `MarketLocked`, `MarketResolved`, `MarketCancelled`, `Claimed`, `Refunded`, `FeeCollected`.

## Invariants (enforced + tested)

No double claim, no double refund, no entry after lock, no early resolution, no outcome change after resolution, no cancellation after resolution, no admin withdrawal of user principal, pause blocks entries but never claims/refunds, fee ≤ hard cap, contract always solvent.

## Test coverage

`forge test` runs 79 tests: unit (lifecycle/entry/claims/refunds/fees/pause/admin), factory validation, resolver health checks (staleness, incomplete rounds, sequencer, grace, Stock Token pause, dynamic decimals, immutable config, timeout cancellation), fuzz (exact floor payouts + solvency), invariant (ghost conservation across a random lifecycle), and the end-to-end vertical slice.

## Data Streams

`IOracleResolver` is the seam for a future Chainlink Data Streams resolver using the mainnet verifier proxy (`0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7`, config-driven). Verification is NOT faked in v0.

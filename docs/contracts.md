# Contracts

Solidity 0.8.31, OpenZeppelin v5, Foundry. See `packages/contracts/README.md` for commands.

## Contracts

| Contract                                                         | Purpose                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `BinaryPoolMarket`                                               | Core pooled parimutuel market: enter, lock, resolve, claim, refund |
| `MarketFactory`                                                  | Admin-only creation of template markets with immutable terms       |
| `OracleRegistry`                                                 | Maps oracle asset key → feed, Stock Token, heartbeat, sequencer    |
| `ChainlinkPriceResolver`                                         | Deterministic AggregatorV3 resolution with health checks           |
| `DataStreamsRwaResolver`                                         | Verifies timestamp-bound Chainlink RWA v11 reports                 |
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

Permissionless — anyone may call `resolve(bytes)` with a signed Data Streams report at/after `resolutionTime` when the market is LOCKED. The production RWA resolver validates the report schema, configured feed ID, exact validity window, expiry, expected market session, positive mid price and price timestamp. The local push-feed resolver validates:

- asset is configured,
- L2 sequencer is up and its grace period has elapsed,
- latest answer > 0, `updatedAt` > 0, and the round is complete,
- timestamp is not in the future and the round is within the configured heartbeat,
- operator pause is clear and Stock Token `oraclePaused()` is readable and false.

The market compares price and strike on a common scale with overflow-safe decimal normalization. Admin can never type the winning outcome.

Each factory-created market snapshots the resolver configuration hash. Feed-term changes block resolution for that market instead of silently changing its terms. Admin cancellation refunds principal. Once `resolutionTime + gracePeriod` passes, anyone can cancel an oracle-unhealthy market and unlock refunds; this path rejects a healthy oracle. If the winning side has zero stake, or the price equals the strike, resolution itself cancels and refunds.

## Events (indexed by the worker)

`MarketCreated` (factory), `PositionEntered`, `MarketLocked`, `MarketResolved`, `MarketCancelled`, `Claimed`, `Refunded`, `FeeCollected`.

## Invariants (enforced + tested)

No double claim, no double refund, no entry after lock, no early resolution, no outcome change after resolution, no cancellation after resolution, no admin withdrawal of user principal, pause blocks entries but never claims/refunds, fee ≤ hard cap, contract always solvent.

## Test coverage

`forge test` includes unit, integration, fuzz and invariant coverage for lifecycle, entry, claims, refunds, fees, pause/admin controls, factory validation, push-feed health, Data Streams v11 proof validation, overflow-safe payout math, immutable oracle terms, timeout cancellation and the end-to-end vertical slice.

## Data Streams

`DataStreamsRwaResolver` calls the mainnet verifier proxy (`0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7`, config-driven). Tests use a mock verifier only to exercise rejection rules; production reports must be fetched through an authenticated Chainlink Data Streams account and are verified onchain.

# Database

## Phase 4 funding projections

Migration `0001_rapid_proemial_gods.sql` adds `tokens`, `token_transfers`, `quotes` and `trade_attributions`.

- `tokens`: identity is `(chain_id,address)`; metadata is display-only. Failed reads are `UNREADABLE`; names never establish trust.
- `token_transfers`: strict ERC-20 logs, unique `(chain_id,tx_hash,log_index)`. ERC-721 topic shapes are excluded. Transfer history discovers candidates; the API reads current `balanceOf` rather than presenting partial backfill totals as authoritative wallet balances.
- `quotes`: exact server quote and swap calldata retained in `route_summary` for receipt binding; no funds or liquidity reservations.
- `trade_attributions`: signed correlation keyed by entry hash; `PENDING`/`CONFIRMED` reflect indexer timing. API and worker use the same advisory lock so a late browser request cannot miss the projected trade. Canonical trade amounts still come from `PositionEntered`.

Reorg rollback removes token transfers and entry projections in the affected window, then resets affected attribution rows for reprocessing. The worker rechecks the swap receipt before restoring attribution; an orphaned swap leaves the entry `UNKNOWN` and marks its correlation `REJECTED`. Metadata is checked in PostgreSQL rather than an unbounded process cache. Tests apply both migrations into randomly named `pl_test_*` schemas and drop only the schema created by that test; normal application data is not truncated.

PostgreSQL via Drizzle ORM. Migrations live in `packages/database/drizzle/` (generated with `pnpm db:generate`, applied with `pnpm db:migrate`).

## Identity conventions

- Token identity: `(chain_id, address)` composite primary keys.
- Event identity: `(chain_id, tx_hash, log_index)` unique constraints.
- Wei amounts are stored as `text` decimal strings (exact); analytics aggregates use `numeric`.

## Tables

| Table                     | Purpose                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `assets`                  | Known ERC-20s: symbol/name/decimals are display metadata only; identity is the key |
| `oracle_assets`           | Feed address, sequencer feed, heartbeat, decimals, pause state                     |
| `markets`                 | Indexed markets: terms, status, pools, resolution, slug                            |
| `market_snapshots`        | Pool-share snapshots over time (capital-split charts)                              |
| `chain_events`            | Raw indexed events (idempotent by `(chainId, txHash, logIndex)`)                   |
| `trades`                  | Entries with optional funding-token attribution + attribution level                |
| `claims`                  | Winner payouts (gross/fee/net)                                                     |
| `refunds`                 | Cancellation refunds (principal)                                                   |
| `wallet_profiles`         | Optional per-wallet metadata                                                       |
| `wallet_stats`            | Aggregated per-wallet performance                                                  |
| `community_stats`         | Per source funding token: volume, wallets, hit rate, PnL                           |
| `market_community_splits` | Per-market YES/NO split by funding community                                       |
| `admin_audit_log`         | Admin actions                                                                      |

## Source-token attribution

`trades.attribution` is one of:

- `SESSION_CORRELATED` — swap receipt correlated with the immediately following market entry in the same browser session (v0; not trustless),
- `ONCHAIN` — reserved for a future hardened `PredictionEntryRouter`,
- `UNKNOWN`.

Wording rule: analytics must say "positions funded with PONS", never "PONS holders believe…".

## Seed

`pnpm seed` reads `packages/contracts/deployments/local.json` (written by `DeployLocal.s.sol`) and upserts the local mock assets, oracle config, and example markets. It is intentionally inert (prints instructions, exits 0) when Postgres or the deployment file is missing, and everything it writes is clearly local/test data.

# Database

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

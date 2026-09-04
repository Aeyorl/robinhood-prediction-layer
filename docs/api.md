# API

Fastify 5 + TypeScript strict + Zod validation + Drizzle (PostgreSQL) + Redis.

## Running

```bash
cp apps/api/.env.example apps/api/.env
pnpm --filter @pl/api dev     # tsx watch
pnpm --filter @pl/api build   # tsup → dist
```

The API starts even when Postgres/Redis are down and reports their real state on `/health` — it never fabricates an "up" state. Data routes return `503 { error: "database_unavailable" }` while the DB is unreachable.

## Endpoints (current)

| Method | Path                                 | Notes                                                                |
| ------ | ------------------------------------ | -------------------------------------------------------------------- |
| GET    | `/health`                            | `{ ok, db: up\|down, redis: up\|down, timestamp }`                   |
| GET    | `/v1/markets?status=&limit=&offset=` | List indexed markets (status filter: OPEN/LOCKED/RESOLVED/CANCELLED) |
| GET    | `/v1/markets/:address`               | Single market by `0x…` address                                       |

All query/param inputs are validated with Zod; invalid input returns `400` with `issues`.

Markets are served from the indexer projection. `chainId` for detail lookups comes from the API's `CHAIN_ID` env — one API instance serves one chain.

## Planned surface (later milestones)

- `/v1/quotes` — server-side funding-token → USDG quote (API keys stay private; chain ID from env; output token forced to canonical USDG; capped slippage + price impact + expiration; configured router allowlist; never trust client-supplied destination/router).
- `/v1/wallet/:address/positions`, `/v1/claims`, `/v1/refunds`
- `/v1/communities/:chainId/:tokenAddress` — source-token analytics
- `/v1/auth/nonce` + signed-message session (admin only)

## Error conventions

Known states return explicit codes (e.g. `quote_expired`, `no_route`, `high_price_impact`) — never a generic "Something went wrong".

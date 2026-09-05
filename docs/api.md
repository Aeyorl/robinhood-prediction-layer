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

| Method | Path                                   | Notes                                                                                                                                    |
| ------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`                              | `{ ok, db: up\|down, redis: up\|down, timestamp }`                                                                                       |
| GET    | `/v1/markets?status=&limit=&offset=`   | List indexed markets (status filter: OPEN/LOCKED/RESOLVED/CANCELLED)                                                                     |
| GET    | `/v1/markets/:address`                 | Single market by `0x…` address                                                                                                           |
| GET    | `/v1/wallets/:address/assets?offset=0` | Indexed token discovery plus configured fallback tokens; live balance/metadata reads, bounded quote eligibility, `nextOffset` pagination |
| GET    | `/v1/wallets/:address/trades`          | Latest 100 indexed trades with source funding token and attribution confidence                                                           |
| POST   | `/v1/quotes`                           | Executable funding quote, persisted for correlation; requires PostgreSQL                                                                 |
| POST   | `/v1/trades/attribution`               | Wallet-signed swap/entry correlation; verifies receipts and updates early or late indexed entries                                        |

All query/param inputs are validated with Zod; invalid input returns `400` with `issues`.

Markets are served from the indexer projection. `chainId` for detail lookups comes from the API's `CHAIN_ID` env — one API instance serves one chain.

## Planned surface (later milestones)

- `/v1/wallet/:address/positions`, `/v1/claims`, `/v1/refunds`
- `/v1/communities/:chainId/:tokenAddress` — source-token analytics
- `/v1/auth/nonce` + signed-message session (admin only)

## Error conventions

Known states return explicit codes (e.g. `quote_expired`, `no_route`, `high_price_impact`) — never a generic "Something went wrong".

## Funding requests

`POST /v1/quotes` takes `{ tokenIn, amountIn, wallet, market? }`. Addresses are full EVM addresses; amounts are positive uint256 decimal strings in raw token units. Extra fields (including client chain, output token, router or slippage) are rejected. The response includes `quoteId`, `chainId`, `adapter`, input/output amounts, `minAmountOut`, `expiresAt` (Unix milliseconds), `approvalSpender` and `swapPlan: { to, data, value }`. A quote does not reserve liquidity. The wallet simulates after approval and checks expiry before submission.

`POST /v1/trades/attribution` takes `{ wallet, quoteId, fundingToken, fundingAmount, swapTxHash, enterTxHash, signature }`. Sign the exact `attributionMessage(chainId, input)` exported by `@pl/types`. This message authorizes only the immutable correlation, bound to chain, wallet, quote, token, amount and both transaction hashes. The same payload is idempotent; there is no reusable trading permission. Successful receipts, transaction sender/target/calldata, swap-before-entry order, quote expiry at inclusion, canonical collateral received and matching entry amount are checked. A swap cannot be attributed to multiple entries. The server never broadcasts transactions.

Legacy attribution responses are `PENDING` until the worker projects the entry, or `CONFIRMED` when it is already indexed. Both represent `SESSION_CORRELATED`. When a quote includes `entryRouter`, the client uses one atomic router transaction and the worker derives `ONCHAIN` attribution from its event; no attribution signature is required. Advisory transaction locks serialize legacy API/worker updates for an entry and prevent concurrent reuse of a swap.

Quotes, assets and attribution have a 20 requests/minute/IP limit (Redis shared when connected, process-local otherwise). Request bodies are capped at 16 KiB. Proxy headers are not trusted by default; configure the deployment's actual proxy boundary before changing this. Common errors: `invalid_request` (400), `invalid_signature` (401), `attribution_conflict`/`swap_already_attributed` (409), `no_route`/`dust`/`unsupported_token`/`high_price_impact` (422), `rate_limited` (429), `adapter_unavailable`/`database_unavailable` (503).

The Uniswap adapter uses the official proxy approval workflow, V2/V3 CLASSIC routes, a fixed recipient, and an explicit allowlist containing Uniswap's current deterministic proxy and immutable legacy proxy. It refuses missing credentials, wrong RPC chain, absent proxy bytecode, altered quote bindings, fees, nonzero native value, and unsafe provider transaction targets. See `docs/swap-flow.md` for the authenticated fork evidence.

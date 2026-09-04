# 04 — API and Database Specification

## 1. General rule

The database is an indexed/read-optimized projection of blockchain state plus offchain metadata. It must never be the source of truth for user funds, market settlement, or claim eligibility.

## 2. PostgreSQL schema

Use lowercase snake_case table/column names and UUIDs for internal offchain entities where appropriate. Blockchain identities use chain ID + address/tx hash/log index.

## 3. `assets`

```text
id uuid pk
chain_id integer not null
contract_address varchar(42) not null
symbol text
name text
decimals integer
logo_url text
asset_type enum('STOCK_TOKEN','MEME','STABLECOIN','CRYPTO','OTHER')
verification_status enum('CANONICAL','VERIFIED','DISCOVERED','UNVERIFIED','BLOCKED')
metadata_source text
supported_as_funding boolean default false
supported_as_outcome boolean default false
created_at timestamptz
updated_at timestamptz
unique(chain_id, contract_address)
```

Never use symbol as unique key.

## 4. `oracle_assets`

```text
id uuid pk
asset_id uuid fk assets
oracle_asset_key text unique
resolver_type enum('CHAINLINK_FEED','CHAINLINK_DATA_STREAM','MOCK')
feed_address varchar(42)
feed_decimals integer
heartbeat_seconds integer
sequencer_feed_address varchar(42)
stock_token_address varchar(42)
active boolean
source_url text
verified_at timestamptz
created_at timestamptz
updated_at timestamptz
```

## 5. `markets`

```text
id uuid pk
chain_id integer
contract_address varchar(42) unique
factory_address varchar(42)
external_id varchar(66)
slug text unique
question text
description text
category text
market_type text
status enum('DRAFT','OPEN','LOCKED','RESOLVED','CANCELLED')
outcome_asset_id uuid fk assets
oracle_asset_id uuid fk oracle_assets
collateral_asset_id uuid fk assets
comparator text
strike_numeric numeric
strike_decimals integer
open_time timestamptz
lock_time timestamptz
resolution_time timestamptz
resolution_grace_seconds integer
fee_bps integer
min_entry_raw numeric
max_entry_raw numeric
yes_pool_raw numeric
no_pool_raw numeric
winning_outcome enum('YES','NO') null
resolved_price_raw numeric null
resolved_at timestamptz null
create_tx_hash varchar(66)
create_block bigint
metadata_hash varchar(66)
created_at timestamptz
updated_at timestamptz
```

## 6. `market_snapshots`

```text
id bigserial pk
market_id uuid fk markets
snapshot_time timestamptz
yes_pool_raw numeric
no_pool_raw numeric
total_volume_raw numeric
unique_participants integer
yes_ratio numeric
no_ratio numeric
unique(market_id, snapshot_time)
```

## 7. `chain_events`

Raw/indexing safety table:

```text
id bigserial pk
chain_id integer
block_number bigint
block_hash varchar(66)
tx_hash varchar(66)
log_index integer
contract_address varchar(42)
event_name text
payload_json jsonb
confirmed boolean
removed boolean default false
created_at timestamptz
unique(chain_id, tx_hash, log_index)
```

## 8. `trades`

A trade is a confirmed prediction entry, not just a swap.

```text
id uuid pk
chain_id integer
market_id uuid fk markets
wallet_address varchar(42)
outcome enum('YES','NO')
collateral_amount_raw numeric
funding_token_id uuid null fk assets
funding_amount_raw numeric null
funding_source enum('DIRECT_USDG','APP_SWAP','ROUTER_SWAP','UNKNOWN')
swap_tx_hash varchar(66) null
entry_tx_hash varchar(66)
entry_log_index integer
block_number bigint
quote_id text null
quoted_collateral_raw numeric null
price_impact_bps integer null
created_at timestamptz
unique(chain_id, entry_tx_hash, entry_log_index)
```

If v0 source-token mapping is inferred from a two-transaction UX, add:

```text
funding_attribution_confidence enum('ONCHAIN','SESSION_CORRELATED','UNKNOWN')
```

Never present correlated metadata as trustless onchain data.

## 9. `claims`

```text
id uuid pk
chain_id integer
market_id uuid
wallet_address varchar(42)
gross_amount_raw numeric
fee_amount_raw numeric
net_amount_raw numeric
tx_hash varchar(66)
log_index integer
block_number bigint
created_at timestamptz
unique(chain_id, tx_hash, log_index)
```

## 10. `refunds`

Same pattern as claims.

## 11. `wallet_profiles`

Optional offchain profile:

```text
wallet_address varchar(42) pk
display_name text
avatar_url text
bio text
created_at timestamptz
updated_at timestamptz
```

Do not require a profile to trade.

## 12. `wallet_stats`

Materialized/derived table:

```text
wallet_address varchar(42) pk
resolved_markets integer
wins integer
losses integer
neutral integer
realized_pnl_raw numeric
roi numeric
hit_rate numeric
total_volume_raw numeric
largest_win_raw numeric
current_streak integer
updated_at timestamptz
```

Stats must be reproducible from raw indexed data.

## 13. `community_stats`

Keyed by funding token.

```text
funding_token_id uuid
window enum('24H','7D','30D','ALL')
normalized_volume_raw numeric
unique_wallets integer
resolved_markets integer
wins integer
losses integer
realized_pnl_raw numeric
updated_at timestamptz
primary key(funding_token_id, window)
```

## 14. `market_community_splits`

```text
market_id uuid
funding_token_id uuid
yes_collateral_raw numeric
no_collateral_raw numeric
unique_wallets integer
updated_at timestamptz
primary key(market_id, funding_token_id)
```

## 15. `admin_audit_log`

```text
id uuid pk
admin_wallet varchar(42)
action text
target text
request_json jsonb
tx_hash varchar(66) null
created_at timestamptz
```

## 16. REST API

Version under `/v1`.

### Health/config

`GET /v1/health`

Returns service health, DB, Redis, RPC connectivity, indexer lag.

`GET /v1/config`

Returns public chain/app config only. Never expose API secrets.

### Markets

`GET /v1/markets`

Query params:

- status
- category
- asset
- sort
- cursor
- limit
- closingBefore
- createdAfter

`GET /v1/markets/:slug`

Returns normalized market metadata + current indexed chain state + oracle descriptor.

`GET /v1/markets/:id/activity`

Paginated confirmed entries/claims/resolution events.

`GET /v1/markets/:id/snapshots`

For charting.

`GET /v1/markets/:id/community-splits`

Funding-token breakdown.

### Assets

`GET /v1/assets`

`GET /v1/assets/:chainId/:address`

`GET /v1/assets/stock-tokens`

This endpoint can periodically sync Robinhood’s official Stock Token asset API for metadata.

### Wallet

`GET /v1/wallet/:address/assets`

Returns discovered balances/metadata/eligibility. Sensitive provider API keys remain server-side.

`GET /v1/wallet/:address/positions`

Indexed positions by market.

`GET /v1/wallet/:address/claimable`

Backend can calculate a preview, but frontend must verify against the contract before enabling final claim transaction.

### Quote

`POST /v1/quotes/entry`

Request:

```json
{
  "marketId": "uuid",
  "wallet": "0x...",
  "outcome": "YES",
  "inputToken": "0x...",
  "inputAmount": "1000000000000000000",
  "slippageBps": 50
}
```

Response:

```json
{
  "quoteId": "...",
  "inputToken": "0x...",
  "inputAmount": "...",
  "collateralToken": "0x...",
  "estimatedCollateralOut": "...",
  "minimumCollateralOut": "...",
  "priceImpactBps": 125,
  "route": "UNISWAP",
  "expiresAt": "...",
  "swapTransaction": {
    "to": "0x...",
    "data": "0x...",
    "value": "0"
  }
}
```

If input token is USDG, return a direct-entry mode instead of a fake swap.

Validate wallet/address/amount/slippage server-side.

### Community

`GET /v1/communities`

`GET /v1/communities/:chainId/:tokenAddress`

`GET /v1/communities/:chainId/:tokenAddress/markets`

### Leaderboard

`GET /v1/leaderboard?metric=pnl|roi|hit_rate|volume&window=7d|30d|all`

Apply minimum participation thresholds to ROI/hit-rate leaderboards to reduce nonsense rankings from one tiny trade.

### Auth

`POST /v1/auth/nonce`

`POST /v1/auth/verify`

`POST /v1/auth/logout`

### Admin

Protected by signed wallet session + role checks.

`POST /v1/admin/markets/prepare`

Builds normalized market parameters and human-readable preview; does not broadcast.

`POST /v1/admin/markets/register`

After admin wallet creates the market onchain, backend records metadata keyed by tx/contract.

`POST /v1/admin/assets/:id/status`

Offchain discovery status only; must not pretend to change token contracts.

## 17. Quote security

The API must never let the client provide an arbitrary transaction target and have the server bless it.

Server must:

- use configured provider endpoint,
- force output token to canonical USDG,
- verify chain ID,
- validate response router address against allowlist,
- cap slippage,
- reject expired quotes,
- reject suspiciously high impact,
- never sign/broadcast on behalf of users.

## 18. Indexing confirmations

Maintain configurable confirmation depth even on L2.

UI states:

- submitted,
- included,
- confirmed,
- indexed.

A transaction can be visible in the wallet receipt before API/indexer projection catches up. The frontend should optimistically refresh chain reads rather than showing a false failure.

## 19. Reorg handling

Store block hash with cursor.

On restart/reconciliation:

1. verify recent indexed block hashes,
2. if mismatch, rewind to safe ancestor,
3. mark orphaned events removed,
4. rebuild projections for affected blocks.

## 20. Rate limits

Apply limits by IP/session/wallet where appropriate:

- quote endpoint stricter than public market reads,
- auth nonce endpoint protected from abuse,
- admin endpoints very strict,
- cache public market discovery responses briefly.

## 21. Robinhood Stock Token metadata sync

The official Robinhood read-only Stock Token REST API can provide:

- assets,
- deployments,
- multipliers,
- logos,
- trading capabilities,
- raw underlying bid/ask,
- corporate actions.

Use it for display/metadata synchronization, not as the sole onchain settlement oracle.

When displaying a raw underlying share price from the REST API and a Stock Token feed price, label them distinctly because the Stock Token multiplier can make them diverge.

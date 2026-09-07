# Oracles

Local/demo markets use Chainlink `AggregatorV3Interface` feeds through `ChainlinkPriceResolver`. Scheduled-time production equity markets use `DataStreamsRwaResolver` with Chainlink Data Streams RWA Advanced (v11) reports verified by the canonical Robinhood Chain verifier proxy.

`ChainlinkPriceResolver` returns the latest push-feed value and cannot prove the price at a past timestamp. It must not be configured for mainnet questions such as "close above at 4:00 PM". The no-proof resolver remains useful for local tests and for any separately reviewed market whose terms explicitly define resolution from the live value when the transaction executes.

## Health checks (all enforced before a price is accepted)

1. Asset is configured in `OracleRegistry`.
2. L2 sequencer uptime feed (when configured) reports up and the post-uptime grace period has elapsed.
3. `latestRoundData().answer > 0`, `updatedAt > 0`, and `answeredInRound >= roundId`.
4. Round timestamp is not in the future and is fresh: `block.timestamp - updatedAt <= heartbeat`.
5. Operator pause is clear and the configured Stock Token's live `oraclePaused()` state is readable and false. An unreadable pause contract fails closed.

Feed decimals are read dynamically with `feed.decimals()` — never assumed to be 8.

## Comparison semantics

The market stores `strike` with `strikeDecimals`. The resolver returns `(price, feedDecimals)` and `BinaryPoolMarket._evaluate` scales both to a common precision before comparing. Example: an 8-decimal USD feed vs an 18-decimal strike of `100.5` — both sides are normalized to 18 decimals.

Comparators are strict:

- `PRICE_ABOVE_AT_TIME` → YES if price > strike, NO if price < strike
- `PRICE_BELOW_AT_TIME` → YES if price < strike, NO if price > strike
- price == strike → no winner → market cancels and refunds

## Data Streams scheduled-time resolution

`BinaryPoolMarket.resolve(bytes)` passes the signed report payload to `DataStreamsRwaResolver`. The resolver calls Chainlink's verifier proxy and accepts only an RWA Advanced v11 report that:

1. matches the configured stream feed ID;
2. has a validity interval containing the market's immutable `resolutionTime`;
3. has not expired;
4. reports the configured market-session status;
5. has a positive mid price; and
6. has a mid-price update timestamp within the configured maximum distance from `resolutionTime`.

The stream ID, decimals, expected session status and maximum price age are timelock-controlled resolution terms included in the market's snapshotted config hash. A wrong schema, feed, time window, session, price, or stale update fails closed.

`BinaryPoolMarket` snapshots `resolver.configHash(assetKey)` at creation. A later feed or resolution-term change cannot silently alter an existing market; resolution rejects a changed hash. Push-feed markets retain the permissionless timeout cancellation path when live health is bad. A Data Streams outage cannot be proven from onchain configuration alone, so a signed report resolves the market or the timelock cancels it and enables refunds.

## Admin UI hook

`IOracleResolver.health(assetKey)` returns a non-reverting snapshot including price freshness, round completion, sequencer state, operator pause, Stock Token pause, and pause-state readability. `/admin` combines live onchain reads for the curated feeds with Robinhood's `/assets` multiplier metadata and `/corporate-actions` warning feed.

## Curated mainnet feeds

`packages/chain-config/src/oracles.ts` contains both the push-feed metadata and the live mainnet RWA Advanced v11 stream IDs discovered for AAPL, NVDA, and TSLA on 2026-09-07. The v11 price fields use 18 decimals. Scheduled regular-hours closing-price terms use the regular-hours stream and expected `marketStatus = 2`; extended and overnight IDs are recorded for market terms that explicitly name those sessions and are never silent fallbacks. Before launch, authenticate the production entitlement with `pnpm data-streams:verify`, select a reviewed maximum price age, and schedule `DataStreamsRwaResolver.setAssetConfig` through the Safe and timelock.

The ECS worker receives `DATA_STREAMS_API_KEY`, `DATA_STREAMS_USER_SECRET`, and `DATA_STREAMS_ENDPOINT` from the dedicated `prediction-layer/production/data-streams` Secrets Manager secret. The secret must contain JSON keys `API_KEY`, `USER_SECRET`, and `ENDPOINT`; credentials must never be placed in a repository file, browser bundle, command argument, or log.

## Asset keys

`bytes32 assetKey = keccak256(abi.encode(uint256(chainId), address(token)))` — identity is `(chainId, contractAddress)`, never a symbol.

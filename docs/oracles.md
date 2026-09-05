# Oracles

v0 uses Chainlink `AggregatorV3Interface` feeds via `ChainlinkPriceResolver`. Robinhood Chain also exposes a Chainlink Data Streams verifier proxy on mainnet — that integration is a later milestone and is not faked.

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

## Resolution timing

AggregatorV3 has no historical reads, so freshness is checked against the live feed at resolution time. `referenceTime` is passed for forward compatibility with a Data Streams resolver that verifies signed reports covering that timestamp.

`BinaryPoolMarket` snapshots `resolver.configHash(assetKey)` at creation. A later feed, heartbeat, sequencer, or Stock Token address change cannot silently alter an existing market; resolution rejects a changed hash. After `resolutionTime + gracePeriod`, anyone may call `cancelAfterOracleTimeout()` when the snapshotted oracle is unhealthy, then participants reclaim principal through the normal `refund()` path. A healthy oracle cannot be bypassed through timeout cancellation.

## Admin UI hook

`IOracleResolver.health(assetKey)` returns a non-reverting snapshot including price freshness, round completion, sequencer state, operator pause, Stock Token pause, and pause-state readability. `/admin` combines live onchain reads for the curated feeds with Robinhood's `/assets` multiplier metadata and `/corporate-actions` warning feed.

## Curated mainnet feeds

`packages/chain-config/src/oracles.ts` contains the launch allowlist for AAPL, NVDA, and TSLA. The token addresses come from Robinhood's Stock Token API and the feed proxies/24-hour heartbeat come from Chainlink's Robinhood mainnet reference-data directory; both were rechecked on September 5, 2026. No official Robinhood Chain sequencer uptime feed is currently listed there, so mainnet entries deliberately keep `sequencerFeed: null` rather than inventing an address. The resolver and tests enforce Chainlink's `0 = up`, `1 = down` convention whenever a verified feed is configured.

## Asset keys

`bytes32 assetKey = keccak256(abi.encode(uint256(chainId), address(token)))` — identity is `(chainId, contractAddress)`, never a symbol.

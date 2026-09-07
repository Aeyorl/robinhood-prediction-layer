# Oracles

Local/demo markets use Chainlink `AggregatorV3Interface` feeds through `ChainlinkPriceResolver`. Production equity markets can use `SafeClosingPriceResolver`, which has no recurring data-subscription cost and resolves from delayed, evidence-bound closing prices approved through the protocol Safe and timelock. `DataStreamsRwaResolver` remains available as an optional paid automation path.

## Zero-subscription Safe closing-price resolution

`SafeClosingPriceResolver` is the default path while paid equity-stream entitlements are unavailable. It does not turn a public website into a trustless oracle. Governance is the oracle, and the product must disclose that fact on every affected market.

For each supported equity, governance configures the price decimals, a challenge period, and the maximum delay allowed between the named close and observation submission. Recommended initial terms are 18 decimals, a 24-hour challenge period, and a four-day submission deadline. The deadline accommodates the protocol timelock before publication. These terms are included in the market's snapshotted config hash and cannot be changed for an existing market.

After the named exchange close:

1. Two operators independently record the official close from the primary source named in the market metadata and one independent secondary source.
2. They record source URLs, retrieval timestamps, timezone, unadjusted closing price, market-calendar status, and any split or corporate-action notice in one canonical JSON evidence document.
3. If the sources disagree, the session was not a normal trading day, or a corporate action makes the terms ambiguous, governance cancels the market so users can refund.
4. Upload the evidence document to durable public storage, hash its exact bytes, and submit `proposeObservation(assetKey, resolutionTime, price, evidenceHash, evidenceUri)` through the Safe and timelock.
5. Display the observation, evidence, and `usableAt` timestamp publicly during the challenge period. A valid challenge must cause the Safe guardian to call `cancelObservation` before the period ends. This cancellation is the Safe's only direct resolver power; configuration and publication remain timelock-controlled.
6. After both the governance delay and resolver challenge period have elapsed, anyone may call the market's no-proof `resolve()` function.

An observation is immutable after publication and cannot be replaced. A cancelled or late observation cannot resolve a market. If no valid observation is available, the factory owner cancels the market and users claim refunds.

This removes the monthly oracle subscription, but mainnet gas, independent contract review, signer operations, monitoring, and legal/compliance work still carry costs. Do not describe it as automated, decentralized, Chainlink-verified, or guaranteed.

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

## Optional Data Streams scheduled-time resolution

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

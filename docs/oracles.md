# Oracles

v0 uses Chainlink `AggregatorV3Interface` feeds via `ChainlinkPriceResolver`. Robinhood Chain also exposes a Chainlink Data Streams verifier proxy on mainnet — that integration is a later milestone and is not faked.

## Health checks (all enforced before a price is accepted)

1. Asset is configured in `OracleRegistry`.
2. L2 sequencer uptime feed (when configured) reports up and the post-uptime grace period has elapsed.
3. `latestRoundData().answer > 0` and `updatedAt > 0`.
4. Round is fresh: `block.timestamp - updatedAt <= heartbeat`.
5. Asset not paused (`oraclePaused()` state around corporate actions for Stock Tokens).

Feed decimals are read dynamically with `feed.decimals()` — never assumed to be 8.

## Comparison semantics

The market stores `strike` with `strikeDecimals`. The resolver returns `(price, feedDecimals)` and `BinaryPoolMarket._evaluate` scales both to a common precision before comparing. Example: an 8-decimal USD feed vs an 18-decimal strike of `100.5` — both sides are normalized to 18 decimals.

Comparators are strict:

- `PRICE_ABOVE_AT_TIME` → YES if price > strike, NO if price < strike
- `PRICE_BELOW_AT_TIME` → YES if price < strike, NO if price > strike
- price == strike → no winner → market cancels and refunds

## Resolution timing

AggregatorV3 has no historical reads, so freshness is checked against the live feed at resolution time. `referenceTime` is passed for forward compatibility with a Data Streams resolver that verifies signed reports covering that timestamp.

## Admin UI hook

`IOracleResolver.health(assetKey)` returns a non-reverting `Health` struct (healthy, price, decimals, updatedAt, isStale, sequencerUp, sequencerGraceElapsed, paused) for the admin market wizard's "latest oracle status" panel.

## Asset keys

`bytes32 assetKey = keccak256(abi.encode(uint256(chainId), address(token)))` — identity is `(chainId, contractAddress)`, never a symbol.

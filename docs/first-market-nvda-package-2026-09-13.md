# First capped market package — NVDA closing price — 2026-09-13

Status: **prepared for review; nothing scheduled, nothing broadcast.** Depends on
Operation 1 (NVDA resolver config) from
`docs/safe-timelock-oracle-configuration-package-2026-09-13.md` being executed
first — `MarketFactory.createMarket` reverts with `oracle asset not configured`
otherwise.

## Market terms (immutable once created)

| Field                 | Value                                                                                                                                                                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Exact binary question | "Will Nvidia (NVDA) close above 180.00 USD at the US market close on Monday, September 14, 2026?"                                                                                                                                                                                                                                                      |
| Asset                 | NVDA Stock Token `0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC` (chain 4663)                                                                                                                                                                                                                                                                             |
| Comparator            | `PRICE_ABOVE_AT_TIME` (enum 0) — strict; equality cancels/refunds                                                                                                                                                                                                                                                                                      |
| Strike                | `180000000` with `strikeDecimals=6` (= 180.000000 USD)                                                                                                                                                                                                                                                                                                 |
| Open time             | `1789372800` = 2026-09-14T08:00:00Z                                                                                                                                                                                                                                                                                                                    |
| Lock (close) time     | `1789415700` = 2026-09-14T19:55:00Z                                                                                                                                                                                                                                                                                                                    |
| Resolution time       | `1789416000` = 2026-09-14T20:00:00Z (US equity close 16:00 ET)                                                                                                                                                                                                                                                                                         |
| Grace period          | `21600` seconds (6 h) — refunds unlock here if unresolved                                                                                                                                                                                                                                                                                              |
| Oracle / resolver     | `SafeClosingPriceResolver` `0x5f25Ad22C84BfCEb146468cC74c73b5C9Bb3BAa5`, `oracleAssetKey=0x48d1cd34a6dd16530cace3d186b6b1e7016db5addf1adc976bb4945194211eb2`                                                                                                                                                                                           |
| Evidence method       | Safe publishes `proposeObservation(assetKey, referenceTime=1789416000, price, evidenceHash, evidenceUri)`; evidence pack = official closing print + retrieval times + corporate-action check + calculation; 1-hour challenge period applies before resolution can succeed; dispute → `cancelObservation` and the market later refunds via timeout path |
| Fee                   | `feeBps=100` (1%, on profit, charged to FeeVault `0x72792B5916dCbf5f0Ae8DB67B748fb5f5c37b89f`)                                                                                                                                                                                                                                                         |
| Capital cap           | `minEntry=1000000` (1 USDG), `maxEntry=10000000` (10 USDG) per user per side — total pool ≤ 20 USDG at 1 user/side; hard canary cap                                                                                                                                                                                                                    |
| Collateral            | USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` (6 decimals)                                                                                                                                                                                                                                                                                         |
| Stale-price behavior  | If no usable observation exists at `resolutionTime + gracePeriod`, the permissionless timeout/cancel path refunds all entrants (no resolution without evidence; missing/cancelled observations never block refunds — `resolutionAvailable()` stays false)                                                                                              |
| Cancellation/refund   | Strict-equality outcome or empty winning side → `CANCELLED` + refunds; separate refund path verified in canary                                                                                                                                                                                                                                         |

## Timelock operation (Safe schedules this after the oracle config)

- **Target contract:** `MarketFactory` `0x62A301F2A0356a16fC1BB02991CfB9cFDb00152C`
- **Function selector:** `createMarket(((address,address,bytes32,uint8,int256,uint8,uint256,uint256,uint256,uint256,uint256,uint256,uint256,string,string,address)))` = `0x7bebfce7`
- **ETH value:** 0
- **Calldata:**
  `0x7bebfce700000000000000000000000000000000000000000000000000000000000000200000000000000000000000005fc5360d0400a0fd4f2af552add042d716f1d1680000000000000000000000005f25ad22c84bfceb146468cc74c73b5c9bb3baa548d1cd34a6dd16530cace3d186b6b1e7016db5addf1adc976bb4945194211eb20000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000aba95000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000006aa7a980000000000000000000000000000000000000000000000000000000006aa85114000000000000000000000000000000000000000000000000000000006aa852400000000000000000000000000000000000000000000000000000000000005460000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000f424000000000000000000000000000000000000000000000000000000000009896800000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000028000000000000000000000000072792b5916dcbf5f0ae8db67b748fb5f5c37b89f000000000000000000000000000000000000000000000000000000000000005f57696c6c204e766964696120284e5644412920636c6f73652061626f7665203138302e30302055534420617420746865205553206d61726b657420636c6f7365206f6e204d6f6e6461792c2053657074656d6265722031342c20323032363f000000000000000000000000000000000000000000000000000000000000000020697066733a2f2f5442442d66697273742d6d61726b65742d65766964656e6365`
- **Salt:** `0x742c6a04fff22f53948e92bb3c2b5d273b48ca182b20b509c819c4f2502b277a` (from `"poku-first-market-nvda-v1"`)
- **Predecessor:** `0x0000000000000000000000000000000000000000000000000000000000000000`
- **Operation ID:** `0x8032b62af3f965a767bacc64fd9d9ced8815b81d02fb1365f42d2a7bdfb6c6f2`
- **Earliest execution:** schedule timestamp + 172800 seconds, and **must be
  before** `openTime` (1789372800) for the market to open on schedule.

## Predicted market address

`createMarket` uses `new BinaryPoolMarket(params)` (CREATE from the factory):

- **Predicted address (factory nonce 1):** `0x2453e631C3B168FBB066Cd2C958f720AAd918CFf`
- Valid **only** if the factory nonce is still 1 at execution time. If any
  market was created in between, the nonce moves and the address changes —
  recompute before signing. Market address is derived, not relied on for
  security: all terms live in the market contract itself.

## Pre-state / post-state

- **Pre:** `MarketFactory.marketCount() == 0`; factory `eth_getTransactionCount == 1`;
  predicted address has no code; `SafeClosingPriceResolver.configs(NVDA key)` =
  `(6,3600,86400,false,true)` (requires Operation 1 executed first);
  `configHash(NVDA) != 0`.
- **Post:** `marketCount() == 1`; `markets(0) ==` predicted address; predicted
  address has `BinaryPoolMarket` code; `status() == OPEN` at open time;
  `question()`, strike, times, fee and cap match the table above exactly;
  `MarketCreated(0, market, params)` event emitted; indexer picks the market up
  from the factory event within one poll interval.

## Sequencing requirements

1. Execute oracle-config Operation 1 (NVDA) — after its own 172800-second delay.
2. Schedule this `createMarket` operation — its earliest execution must land
   before `openTime`. If the timing does not fit, update the times in this
   package (recompute calldata, salt, operation ID, predicted address) and
   re-review. **Never sign stale calldata.**
3. After execution, verify pre/post state, then start the canary
   (Task 12): one small YES entry, one small NO entry, allowance check, index
   check, evidence publication, resolution, winner claim, and a separate
   cancellation/refund exercise on a second identical market if needed.

## Rollback / cancellation procedure

- Before execution: `ProtocolTimelock.cancel(operationId)` via Safe — no delay.
- After market creation but before lock: Safe can `MarketFactory.pauseMarket(market)`
  (blocks new entries, never blocks claims/refunds) or `cancelMarket(market)`
  (refunds everyone) through a new timelock operation.
- After lock: no admin action can alter resolution; the only interventions are
  the evidence challenge (cancel the observation within 1 hour) and the timeout
  refund path.

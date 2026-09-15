# First capped market package — NVDA closing price (refreshed proposal)

Status: **draft for review; no Safe transaction has been signed, scheduled or broadcast.** This replaces the expired September 14 proposal. The proposal deliberately uses a future window so governance can complete before opening.

## Proposed terms

| Field         | Proposed value                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| Question      | Will Nvidia (NVDA) close above **180.00 USD** at the US regular-market close on Monday, September 21, 2026? |
| Chain / asset | Robinhood Chain (4663); NVDA Stock Token `0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC`                       |
| Comparator    | `PRICE_ABOVE_AT_TIME`; equality cancels and refunds                                                         |
| Strike        | `180000000`, `strikeDecimals=6`                                                                             |
| Open          | `2026-09-21T08:00:00Z`                                                                                      |
| Lock          | `2026-09-21T19:55:00Z`                                                                                      |
| Resolution    | `2026-09-21T20:00:00Z`                                                                                      |
| Grace period  | 6 hours                                                                                                     |
| Resolver      | SafeClosingPriceResolver `0x5f25Ad22C84BfCEb146468cC74c73b5C9Bb3BAa5`                                       |
| Collateral    | USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`                                                           |
| Fee / cap     | 1% profit fee; 1–10 USDG per user per side; 20 USDG total canary cap                                        |

The strike and schedule are still **proposed**. Before signing, obtain a current NVDA reference price and corporate-action check, confirm the regular-hours Data Streams feed entitlement, and decide whether 180.00 remains an appropriate binary threshold. If any term changes, regenerate every encoded field and the operation ID; never reuse the expired calldata.

## Governance sequence

1. Wait for the already scheduled Poku-to-MAG7 timelock ownership transfer to mature on September 17, 2026 at 11:16:42 WAT, then execute it through the shared Safe.
2. Verify all seven owners equal MAG7 timelock `0xBC8A2ac01AeEb849A15825e9FA12ebFBe83Dd8d8`.
3. Generate fresh calldata for `setAssetConfig` for the NVDA asset key and this `createMarket` proposal. Schedule each through MAG7 timelock; each has a 172800-second delay.
4. After execution, verify the market terms, status, factory count, event indexing, and API response before any UI enablement.

The market address, salts, operation IDs, and calldata are intentionally omitted from this draft until the final strike and timestamps are approved. This prevents signing stale terms.

## Launch gates

Data Streams discovery succeeded previously, but report retrieval returned `401 feeds not authorized`; entitlement must be fixed or the reviewed Safe closing-price evidence path must be selected. The production API/indexer, monitoring, resolution, claim, cancellation and refund paths must pass a capped canary. Public trading stays disabled until those checks pass. This document is not legal approval, an audit, or authorization to accept user funds.

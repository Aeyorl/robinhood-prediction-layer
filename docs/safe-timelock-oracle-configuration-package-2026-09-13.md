# Safe/timelock oracle-configuration package — 2026-09-13

Status: **prepared for review; nothing scheduled, nothing broadcast.** Each
operation requires explicit 2-of-3 Safe signatures and a manual execution only
after the full 172800-second delay. Onchain pre-state read from the public RPC
(`rpc.mainnet.chain.robinhood.com`) on 2026-09-13.

## Governance path (identical for all operations)

1. **Schedule (Safe tx):** Safe `0x5A205159348BBe6c4A5a264B59fC8Df7A4ab6a39`
   (timelock PROPOSER) executes `ProtocolTimelock.schedule(target, 0, data,
predecessor, salt)` with `delay` = 172800.
2. **Wait** the full 172800 seconds. No path may shorten this.
3. **Execute (Safe tx):** Safe (timelock EXECUTOR) executes
   `ProtocolTimelock.execute(target, 0, data, predecessor, salt)`.
4. The timelock (owner of every protocol contract) performs the call.

## Operation 1 of 3 — NVDA closing-price resolver config

- **Target contract:** `SafeClosingPriceResolver`
  `0x5f25Ad22C84BfCEb146468cC74c73b5C9Bb3BAa5`
- **Function selector:** `setAssetConfig(bytes32,uint8,uint64,uint64,bool)` =
  `0x700a13bc`
- **Decoded call:** `setAssetConfig(assetKey=0x48d1cd34a6dd16530cace3d186b6b1e7016db5addf1adc976bb4945194211eb2, decimals=6, challengePeriod=3600, maxObservationDelay=86400, paused=false)`
- **assetKey derivation:** `keccak256(abi.encode(uint256(4663), address(0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC)))` (NVDA Stock Token per `packages/chain-config/src/oracles.ts`)
- **ETH value:** 0
- **Calldata:**
  `0x700a13bc48d1cd34a6dd16530cace3d186b6b1e7016db5addf1adc976bb4945194211eb200000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000e1000000000000000000000000000000000000000000000000000000000000151800000000000000000000000000000000000000000000000000000000000000000`
- **Salt:** `0x0c88df233947e05977d1b88d7855e7232675d3aec3ecfa3c58c53d0fb3902fa0` (from `"poku-oracle-config-nvda-v1"`)
- **Predecessor:** `0x0000000000000000000000000000000000000000000000000000000000000000`
- **Operation ID:** `0x0e24c5c20e520d98437329844955b244dfedec85c6aec14f8d5aa5ea3dbbdd50`
- **Earliest execution:** block.timestamp of the schedule transaction + 172800 seconds
- **Pre-state (measured 2026-09-13):** `configs(assetKey)` = `(0,0,0,false,false)`;
  `configHash(assetKey)` = `0x0000…0000`
- **Expected post-state:** `configs(assetKey)` = `(6,3600,86400,false,true)`;
  `configHash(assetKey)` = `keccak256(abi.encode(resolver, guardian, 6, 3600, 86400))`;
  `AssetConfigured` event emitted; markets using this key can be created
  (`createMarket` requires nonzero `configHash`).

## Operation 2 of 3 — AAPL closing-price resolver config

- **Target:** `0x5f25Ad22C84BfCEb146468cC74c73b5C9Bb3BAa5`, selector `0x700a13bc`
- **Decoded:** `setAssetConfig(0x87795462123f9c80baf6774787eabcc72d71b86a1d5119f2d0cda06f860a3e5b, 6, 3600, 86400, false)` (AAPL token `0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9`)
- **ETH value:** 0
- **Calldata:**
  `0x700a13bc87795462123f9c80baf6774787eabcc72d71b86a1d5119f2d0cda06f860a3e5b00000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000e1000000000000000000000000000000000000000000000000000000000000151800000000000000000000000000000000000000000000000000000000000000000`
- **Salt:** `0xd6908fff924a8d5a56e82dab5af798258133716b8a8783c3d12caa9ccc16f4b3`
- **Predecessor:** `0x0000…0000`
- **Operation ID:** `0xc739a66dd1096ea7664198b2c61192267e2bd1d2e27934d91a7c47aca59ceaa4`
- **Pre-state:** unconfigured (same shape as NVDA). **Post-state:** `(6,3600,86400,false,true)`.

## Operation 3 of 3 — TSLA closing-price resolver config

- **Target:** `0x5f25Ad22C84BfCEb146468cC74c73b5C9Bb3BAa5`, selector `0x700a13bc`
- **Decoded:** `setAssetConfig(0xbbd053899125ef4bd3f01681508dd48742ba0267e1c6efabdb05cb1fa6a16418, 6, 3600, 86400, false)` (TSLA token `0x322F0929c4625eD5bAd873c95208D54E1c003b2d`)
- **ETH value:** 0
- **Calldata:**
  `0x700a13bcbbd053899125ef4bd3f01681508dd48742ba0267e1c6efabdb05cb1fa6a1641800000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000e1000000000000000000000000000000000000000000000000000000000000151800000000000000000000000000000000000000000000000000000000000000000`
- **Salt:** `0x54b9a5a84a86bf1845de0b97a2a3f455ad701c20c5af29214b3fdd3cfbbf34fb`
- **Predecessor:** `0x0000…0000`
- **Operation ID:** `0x2113b8974e874c114f8407713389bb6bf53641b74d3d7cc8c83bc7a39081c7dc`
- **Pre-state:** unconfigured. **Post-state:** `(6,3600,86400,false,true)`.

## Parameter rationale

- `decimals=6`: strikes are denominated in USD with 6 decimals (USDG precision).
- `challengePeriod=3600` (1 hour): observation disputes must resolve before the
  market's 6-hour `gracePeriod` elapses, or resolution can never succeed.
- `maxObservationDelay=86400` (24 h): the Safe must publish the closing
  observation within one day of the market close.
- `paused=false`: config ships usable; any pause later goes through the same
  timelock path (`setPaused`), which is also the fast kill switch available to
  the guardian/timelock.

## Evidence rules and allowed assets (recorded, onchain where applicable)

- Registry/resolver `assetKey` identity is always `(chainId, token address)` —
  never a symbol (`docs/oracles.md`). The three keys above are the only
  configured assets; everything else stays unconfigured and therefore disabled.
- Push-feed `ChainlinkPriceResolver` must never back scheduled-close markets
  (`docs/internal-security-review-2026-09-08.md`, PL-08 note). The first market
  uses `SafeClosingPriceResolver` only.
- Data Streams `DataStreamsRwaResolver` remains unconfigured until the API key
  entitlement covers the feed IDs ("feeds not authorized" — see
  `docs/aws-operations-evidence-2026-09-13.md`).

## Rollback / cancellation procedure

- Before execution: Safe (CANCELLER) calls `ProtocolTimelock.cancel(operationId)`
  — no delay applies to cancellation.
- After execution: configuration can be changed only by scheduling a new
  `setAssetConfig` through the same 2-day timelock; the market freezes
  `configHash` at creation, so an already-created market is immune to later
  reconfiguration (`OracleConfigChanged` guard) and would refund via cancel
  path if its oracle changed.
- Immediate operational pause: `SafeClosingPriceResolver.setPaused(assetKey, true)`
  via the same timelock path.

## Verification checklist before signing

1. Recompute every operation ID from the calldata/salt above on a clean checkout.
2. Confirm the resolver address via `eth_getCode` and Blockscout source verification.
3. Confirm the Safe is still 2-of-3 with the expected owner set.
4. Confirm `getMinDelay() == 172800`.
5. Two owners sign the EIP-712 Safe transaction; execute only after the delay.

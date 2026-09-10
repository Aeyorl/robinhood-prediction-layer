# Poku Safe and timelock release preparation — 2026-09-10

Status: **prepared; owner signatures and mainnet deployment remain pending**.

## Release binding

- Final contract audit tag: `prediction-layer-mainnet-audit-rc4`
- Final contract audit commit: `9f11dccfa74cb57406ff796a3d771bd5a9d59366`
- Cross-platform manifest: `audit/ARTIFACTS-rc4.sha256`
- Manifest SHA-256: `65f795d6acd2b1675f46fff1d4acafe2074d4bd43bf2140f9356532b919b317f`
- V2 typed-data hash: `0xb95eb425feb1566d259b20ad9cf859383de1ac6c67979162a1e43e0c0cd24778`
- Deployment authorization in signed payload: `false`

The V1 RC1 evidence is retained as historical evidence and must not be cited as
approval for this release. The V2 payload uses a schema-valid 32-byte value for
the Git commit and directly binds the artifact-manifest digest.

## Live read-only governance verification

Observed through the Robinhood Chain public RPC on 2026-09-10:

- Shared MAG7/Poku Safe: `0x5A205159348BBe6c4A5a264B59fC8Df7A4ab6a39`
- Current Safe nonce: `6`
- Threshold: `2`
- Owners:
  - `0xa5e7d6C189b37D9293908E0A28Da4D65d65a7f7A`
  - `0x26032745BcB969B95B4610A9a48D33Bd4340812D`
  - `0x8cA71B70C91BD8250073dfDD323b9219Bce6A165`
- Existing MAG7 timelock/immutable Poku fee recipient:
  `0xBC8A2ac01AeEb849A15825e9FA12ebFBe83Dd8d8`
- Existing MAG7 timelock delay: `172800` seconds
- Shared Safe has the MAG7 timelock proposer role: `true`

Poku will deploy a separate `ProtocolTimelock` with the same Safe as sole
proposer, executor and canceller. The MAG7 timelock is reused only as the fee
recipient. This preserves the approved client governance identity without
mixing Poku administration into MAG7's operation queue.

## Two-day timelock rehearsal

The focused Foundry rehearsal deploys a fresh `ProtocolTimelock`, schedules a
harmless target call from the shared-Safe role, verifies execution reverts
before the delay, advances exactly two days, executes the call, and verifies the
operation is complete.

Command:

```powershell
forge test --root packages/contracts --match-contract ProtocolTimelockTest -vv
```

Result: **2 passed, 0 failed**. This is a deterministic local rehearsal; it is
not a mainnet deployment or a substitute for the post-deployment onchain
rehearsal.

## Remaining ceremony actions

1. Two distinct current owners sign the V2 payload with the local MetaMask tool.
2. Merge the public signature values into
   `audit/safe-ceremony-metamask-signatures-v2.json`.
3. Run `node scripts/verify-safe-ceremony.mjs` and preserve its output.
4. Complete the private recovery-control record outside Git for each signer.
5. Obtain the still-required external audit/retest and compliance approvals.
6. Prepare the exact deployment transaction set and obtain explicit approval
   before any mainnet broadcast.
7. After deployment, verify bytecode, roles, owners and delay, then schedule and
   execute the harmless onchain rehearsal across the full 48-hour delay.

No mainnet transaction was broadcast during this preparation.

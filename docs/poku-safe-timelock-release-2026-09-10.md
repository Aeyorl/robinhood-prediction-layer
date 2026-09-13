# Poku Safe and timelock release preparation — 2026-09-10

Status: **V2 two-of-three signatures verified; private recovery, AWS runtime, and mainnet deployment remain pending**.

## Release binding

- Final release tag: `prediction-layer-mainnet-audit-rc5`
- Final release commit: `8d134efe6e3c65e70d1509628d8b6932ee6d3bb8`
- Cross-platform manifest: `audit/ARTIFACTS-rc5.sha256`
- Manifest SHA-256: `f9d5fc1dd7bcd255bdc4f7bc10ddfdc82361b32ac9cb210a3d1b28f08380bc79`
- V2 typed-data hash: `0xb2314caed249d60ca133768e95135a5073769b6358cc2aa23edcc421c20cec2c`
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

## V2 MetaMask signatures

Two distinct current Safe owners signed `audit/safe-ceremony-eip712-v2.json`
through the local MetaMask tool. Public evidence is in
`audit/safe-ceremony-metamask-signatures-v2.json`. Status is
`two-of-three-verified`.

- Recovered owners: `0xa5e7d6C189b37D9293908E0A28Da4D65d65a7f7A` and
  `0x8cA71B70C91BD8250073dfDD323b9219Bce6A165`
- Wallet type: MetaMask software wallet
- Signed at: `2026-09-10T19:44:19.811Z` and `2026-09-10T19:43:50.506Z`
- Live Safe re-read after signing: nonce `6`, threshold `2`, owner set unchanged
- `node scripts/verify-safe-ceremony.mjs` output:

```text
Typed-data hash: 0xb2314caed249d60ca133768e95135a5073769b6358cc2aa23edcc421c20cec2c
Verified: 0xa5e7d6C189b37D9293908E0A28Da4D65d65a7f7A
Verified: 0x8cA71B70C91BD8250073dfDD323b9219Bce6A165
Ceremony threshold satisfied: 2 verified owners
```

These signatures prove control of the two listed owner addresses at signing
time. They do not authorize deployment, funding, a Safe transaction, or a
change to any launch gate. They do not prove hardware-wallet custody or
offline recovery readiness.

## Remaining ceremony actions

1. Complete the private recovery-control record outside Git for each signer.
2. Obtain the still-required external audit/retest and compliance approvals.
3. Subscribe and confirm an on-call destination on
   `prediction-layer-production-alerts`.
4. Approve the monitoring-stack update that adds application log-metric alarms.
5. Prepare the exact deployment transaction set and obtain explicit approval
   before any mainnet broadcast.
6. After deployment, verify bytecode, roles, owners and delay, then schedule and
   execute the harmless onchain rehearsal across the full 48-hour delay.

No mainnet transaction was broadcast during this preparation.

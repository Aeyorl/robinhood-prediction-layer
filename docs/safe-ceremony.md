# Safe and timelock ceremony

`ProtocolTimelock` has a fixed two-day delay. The Safe is its sole proposer, executor and canceller, with no external admin. Core contracts and the router are created with the timelock as owner.

Record at least three independently controlled hardware-wallet signer addresses, a 2-of-3 or stricter threshold, recovery contacts and a signed ceremony record. Each signer verifies chain ID 4663, bytecode hashes, constructor arguments and canonical addresses. Fund only the designated deployer with bounded gas.

After deployment, verify source and constructor arguments on Blockscout; check owners, threshold, roles and delay; confirm every protocol owner equals the timelock; confirm the deployer has no role; execute a harmless delayed rehearsal; then schedule the audited swap-target allowlist. Save transaction hashes and blocks in the release manifest.

Execution requires signer addresses, threshold, fee recipient, audited swap target, production RPC secret and explicit mainnet approval.

## Existing Safe candidate

The product owner confirmed on 2026-09-07 that Wagerly will reuse the same client governance Safe used for MAG7: `0x5A205159348BBe6c4A5a264B59fC8Df7A4ab6a39`. A dedicated-RPC read on chain 4663 found deployed Safe v1.4.1 proxy code, nonce 4, three owners (`0xa5e7…7f7A`, `0x2603…812D`, `0x8cA7…A165`) and threshold 2. MAG7's successful two-owner signer rehearsal is carried forward as operational evidence. The selected one-time deployer is `0x913B8D346625736958664C77b0C8Efd3DA2a7bA2`; the immutable fee recipient is MAG7's existing timelock `0xBC8A2ac01AeEb849A15825e9FA12ebFBe83Dd8d8`. Hardware-wallet custody, recovery contacts and a signed Wagerly ceremony record remain required before deployment. See `safe-verification-2026-09-07.md` and `deployment-identity-2026-09-07.md`.

## Hardware-wallet attestation

The signing payload is `audit/safe-ceremony-eip712-v1.json`. Each owner reviews the displayed domain, chain ID, Safe address, audit candidate and ceremony-message hash on an independently controlled device, then signs with one of:

```powershell
cast wallet sign --ledger --data --from-file audit/safe-ceremony-eip712-v1.json
cast wallet sign --trezor --data --from-file audit/safe-ceremony-eip712-v1.json
```

Use only the command matching the connected device. Never enter or record a seed phrase, PIN or private key in the repository or terminal. Record the resulting public signature in the secure ceremony evidence and verify it against the expected owner address:

```powershell
cast wallet verify --address <SAFE_OWNER> --data --from-file audit/safe-ceremony-eip712-v1.json <SIGNATURE>
```

At least two verified owner signatures are required. These attestations confirm readiness and custody only; they do not authorize or broadcast a Safe transaction.

## MetaMask-only owners

When an existing Safe owner is controlled by a regular MetaMask software wallet, use the local signer at `tools/safe-ceremony/index.html` to collect the same EIP-712 readiness attestation without exposing a private key. The downloaded JSON evidence is public signature material and can be checked with `cast wallet verify` as shown above.

A MetaMask signature proves control of the selected Safe owner address at signing time. It does not prove hardware isolation, independent physical custody or offline recovery readiness, so it does not satisfy a release policy that explicitly requires hardware wallets. Record that exception accurately and obtain the required client/security approval before changing the hardware-custody gate.

## V2 release-bound ceremony

The corrected payload is `audit/safe-ceremony-eip712-v2.json`. It binds the
signature to `prediction-layer-mainnet-audit-rc4` at full commit
`9f11dccfa74cb57406ff796a3d771bd5a9d59366`, the cross-platform Git-blob
manifest `audit/ARTIFACTS-rc4.sha256`, and the public V2 attestation text.
The 20-byte Git object ID is explicitly left-padded to a schema-valid
`bytes32`. The payload records the currently observed Safe nonce for context;
this is a readiness signature and is not a Safe transaction signature.

Regenerate the manifest reproducibly with:

```powershell
node scripts/release-manifest.mjs prediction-layer-mainnet-audit-rc4 audit/ARTIFACTS-rc4.sha256
```

At least two owners must separately use the local signer and return their
downloaded public evidence files. Verify each recovered signer against the
current onchain owner set before changing
`audit/safe-ceremony-metamask-signatures-v2.json` from pending. Keep recovery
contacts, seed-backup details and device-specific controls outside Git.

After adding the two public signatures, run:

```powershell
node scripts/verify-safe-ceremony.mjs
```

The verifier rejects unknown owners, duplicate signers, invalid signatures and
evidence below the Safe threshold.

The shared MAG7 Safe is reused as Poku's governance signer set. Poku deploys a
dedicated `ProtocolTimelock` controlled by that Safe. The existing MAG7
timelock remains only Poku's immutable fee recipient, avoiding shared admin
operation queues between the two products.

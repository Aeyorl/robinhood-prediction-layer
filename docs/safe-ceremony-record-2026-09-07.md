# Wagerly Safe ceremony record

Status: **prepared; hardware custody and recovery attestations are unsigned**.

## Fixed governance identity

- Chain ID: `4663`
- Governance Safe: `0x5A205159348BBe6c4A5a264B59fC8Df7A4ab6a39`
- Required threshold: `2` of `3`
- Owner 1: `0xa5e7d6C189b37D9293908E0A28Da4D65d65a7f7A`
- Owner 2: `0x26032745BcB969B95B4610A9a48D33Bd4340812D`
- Owner 3: `0x8cA71B70C91BD8250073dfDD323b9219Bce6A165`
- One-time deployer: `0x913B8D346625736958664C77b0C8Efd3DA2a7bA2`
- Fee recipient: `0xBC8A2ac01AeEb849A15825e9FA12ebFBe83Dd8d8`
- Protocol timelock delay: `172800` seconds
- Audit release tag: `prediction-layer-mainnet-audit-rc1`
- Audit candidate commit: `2a207eaaca9b2c60ff93c0f1b086c35331376917`
- Safe version observed: `1.4.1`
- Safe nonce observed before ceremony: `4`
- Ceremony message: `audit/safe-ceremony-attestation-v1.txt`
- Ceremony message SHA-256: generated alongside the message in `audit/safe-ceremony-attestation-v1.sha256`
- Hardware signing payload: `audit/safe-ceremony-eip712-v1.json`

The owner addresses and threshold were read on Robinhood Chain mainnet. The prior MAG7 two-signer rehearsal proves transaction authorization on this Safe, but does not prove physical custody or recovery readiness for this release.

## Software-wallet signatures

Two EIP-712 readiness signatures from owners `0xa5e7…7f7A` and `0x8cA7…A165` were captured through MetaMask and independently verified with `cast wallet verify`. The public evidence is in `audit/safe-ceremony-metamask-signatures-v1.json`. The two signatures match the recorded Safe threshold. They attest to the fixed candidate and observed nonce 4 with deploymentAuthorized=false; they are not deployment authorization. These software-wallet signatures do not satisfy the separate hardware-custody and offline-backup attestations below.

## Signer attestations

Each owner completes one row without recording a seed phrase, PIN, private key, device serial number, or other authentication secret in this repository.

| Safe owner    | Hardware wallet independently controlled | Backup tested offline | Recovery contact recorded in the operator's secure system | Signer initials and date |
| ------------- | ---------------------------------------- | --------------------- | --------------------------------------------------------- | ------------------------ |
| `0xa5e7…7f7A` | Pending                                  | Pending               | Pending                                                   | Pending                  |
| `0x2603…812D` | Pending                                  | Pending               | Pending                                                   | Pending                  |
| `0x8cA7…A165` | Pending                                  | Pending               | Pending                                                   | Pending                  |

## Ceremony checks

| Check                                                                 | Evidence                                                  | Status  |
| --------------------------------------------------------------------- | --------------------------------------------------------- | ------- |
| Each signer independently confirms chain ID `4663`                    | Signed ceremony attachment                                | Pending |
| Each signer verifies Safe owners and 2-of-3 threshold                 | Signed ceremony attachment                                | Pending |
| Each signer verifies the audit tag and full commit SHA                | Audit release record                                      | Pending |
| Each signer verifies constructor arguments and canonical dependencies | Deployment manifest                                       | Pending |
| Bounded deployer funding is approved                                  | Fresh no-broadcast simulation and signed release decision | Pending |
| Protocol ownership is transferred to the newly deployed timelock      | Deployment transactions                                   | Pending |
| Deployer retains no role                                              | Post-deployment role reads                                | Pending |
| A harmless 48-hour schedule/execute rehearsal succeeds                | Transaction hashes and blocks                             | Pending |

## Approval

- Ceremony coordinator: Pending
- Date and time (UTC): Pending
- Secure evidence location/reference: Pending
- Coordinator signature: Pending
- Client release approver: Pending
- Client signature: Pending

This file is a ceremony template and records verified public addresses. It is not a completed ceremony until every pending field has supporting evidence and signatures.

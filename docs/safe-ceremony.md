# Safe and timelock ceremony

`ProtocolTimelock` has a fixed two-day delay. The Safe is its sole proposer, executor and canceller, with no external admin. Core contracts and the router are created with the timelock as owner.

Record at least three independently controlled hardware-wallet signer addresses, a 2-of-3 or stricter threshold, recovery contacts and a signed ceremony record. Each signer verifies chain ID 4663, bytecode hashes, constructor arguments and canonical addresses. Fund only the designated deployer with bounded gas.

After deployment, verify source and constructor arguments on Blockscout; check owners, threshold, roles and delay; confirm every protocol owner equals the timelock; confirm the deployer has no role; execute a harmless delayed rehearsal; then schedule the audited swap-target allowlist. Save transaction hashes and blocks in the release manifest.

Execution requires signer addresses, threshold, fee recipient, audited swap target, production RPC secret and explicit mainnet approval.

## Existing Safe candidate

The product owner confirmed on 2026-09-07 that Prediction Layer will reuse the same client governance Safe used for MAG7: `0x5A205159348BBe6c4A5a264B59fC8Df7A4ab6a39`. A dedicated-RPC read on chain 4663 found deployed Safe v1.4.1 proxy code, nonce 4, three owners (`0xa5e7…7f7A`, `0x2603…812D`, `0x8cA7…A165`) and threshold 2. MAG7's successful two-owner signer rehearsal is carried forward as operational evidence. Hardware-wallet custody, recovery contacts, the Prediction Layer signed ceremony record, deployer and fee recipient remain required before `Deploy.s.sol` uses it. See `safe-verification-2026-09-07.md`.

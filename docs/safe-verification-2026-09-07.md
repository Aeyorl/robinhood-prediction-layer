# Safe candidate verification — 2026-09-07

The product owner confirmed on 2026-09-07 that Wagerly will reuse the same governance Safe used for MAG7 because both products are being built for the same client. This records the governance-address decision, signer-control ceremony and current onchain state. The owners use regular MetaMask wallets, as confirmed by the product owner; hardware-wallet custody is therefore not claimed.

## Observed state

- Chain ID: `4663`
- Candidate Safe: `0x5A205159348BBe6c4A5a264B59fC8Df7A4ab6a39`
- Owners:
  - `0xa5e7d6C189b37D9293908E0A28Da4D65d65a7f7A`
  - `0x26032745BcB969B95B4610A9a48D33Bd4340812D`
  - `0x8cA71B70C91BD8250073dfDD323b9219Bce6A165`
- Threshold: `2`
- Nonce: `4`
- Native balance: `0`
- Safe version: `1.4.1`
- Proxy singleton slot: `0x00000000000000000000000029fcb43b46531bca003ddc8fcb67ffe91900c762`
- Proxy bytecode hash: `0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c`

The state was read using standard Safe view calls (`getOwners()`, `getThreshold()`, `nonce()` and `VERSION()`) plus proxy storage and code-hash reads through the dedicated production RPC. Both the Safe state and RPC chain ID `4663` were rechecked after the ownership decision.

## Reused MAG7 signer evidence

The MAG7 governance record documents a successful two-signer rehearsal on this exact Safe. Two owners authorized a zero-value `changeThreshold(2)` call, a separate non-owner executor submitted it, and transaction `0xc314cc2aa7eebf683221ea98fb5bf2f332bd06baad800b9e886d1808eb3fb4b6` succeeded at block `55120772`. The Safe retained the same three owners and 2-of-3 threshold.

That rehearsal establishes that two independently controlled owners could authorize a Safe transaction. It does not establish the physical custody or recovery controls required for Wagerly's launch record.

## Wagerly ceremony acceptance — 2026-09-08

Wagerly accepts the successful MAG7 transaction as its signer-control ceremony because it uses the same client Safe and unchanged owner set. A live recheck on Robinhood Chain mainnet returned chain ID `4663`, the same three owners and threshold `2`. The ceremony transaction receipt returned status `1` at block `55120772` and contains the Safe threshold-change event setting threshold `2`.

Signer-control ceremony status: **complete and verified onchain**.

## Required operator evidence

Before deployment, the operator must retain a private mapping from each owner address to its responsible person, record recovery contacts, and confirm that each MetaMask seed backup is independently controlled. Never store names, seed phrases or private keys in this repository. The Safe needs bounded native gas before it can execute transactions.

## Deployment evidence still required

The two-day timelock deployment, role grants, ownership transfers, deployer-role removal, source verification, transaction hashes, block numbers and harmless delayed rehearsal remain incomplete. Mainnet write operations stay disabled until the independent audit, compliance approval and production address manifest are also complete.

# Safe candidate verification — 2026-09-07

This is read-only onchain evidence, not proof that the Safe belongs to Prediction Layer and not a completed signer ceremony.

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

The state was read using standard Safe view calls (`getOwners()`, `getThreshold()`, `nonce()` and `VERSION()`) plus proxy storage and code-hash reads through a Robinhood Chain public RPC. Public RPC was used only for independent read verification; it is not approved as the production service endpoint.

## Required owner evidence

Before deployment, the product owner must identify this address as the intended protocol Safe, map each owner address to an independently controlled hardware wallet, name the deployer and fee recipient, record recovery contacts, and sign the ceremony record. The Safe needs bounded native gas before it can execute transactions.

## Deployment evidence still required

The two-day timelock deployment, role grants, ownership transfers, deployer-role removal, source verification, transaction hashes, block numbers and harmless delayed rehearsal remain incomplete. Mainnet write operations stay disabled until the independent audit, compliance approval and production address manifest are also complete.

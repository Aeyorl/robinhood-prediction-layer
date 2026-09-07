# Production deployment identity — 2026-09-07

The product owner authorized Prediction Layer to reuse existing MAG7 client-controlled addresses for the one-time deployer and fixed protocol-fee recipient.

## Deployer

- Address: `0x913B8D346625736958664C77b0C8Efd3DA2a7bA2`
- Provenance: sender of the MAG7 mainnet deployment transactions
- Safe owner: no
- Native balance at verification: approximately `0.00003065 ETH`

The address satisfies deployer/Safe role separation. Its current balance is not assumed sufficient; estimate the final deployment transaction set and fund only the bounded gas amount after every release gate passes. The deployer must receive no protocol role and its key must be retired after verified deployment.

## Fee recipient

- Address: `0xBC8A2ac01AeEb849A15825e9FA12ebFBe83Dd8d8`
- Identity: existing MAG7 `TimelockController`
- Minimum delay: `172800` seconds
- Proposer: shared client Safe `0x5A205159348BBe6c4A5a264B59fC8Df7A4ab6a39`
- Executor: the same shared client Safe
- Open executor: no
- Safe administrator: no
- Zero-address administrator: no
- Runtime code hash: `0x9e659b00ab93c9b14b6c603ab210f3d9306658babafe381767912b72bf6b2195`

`FeeVault` holds collected tokens under the new Prediction Layer timelock and can withdraw only to this immutable recipient. Moving received USDG onward from the MAG7 timelock requires a separate transaction scheduled and executed by the shared client Safe after its 48-hour delay. This intentionally keeps fee custody away from the one-time deployer, while coupling fee disbursement to the client's existing governance timelock.

## GitHub environment

The protected `mainnet` environment records the public `DEPLOYER_ADDRESS` and `FEE_RECIPIENT` values. `DEPLOYER_PRIVATE_KEY` remains unset. The values authorize configuration preparation only; they do not satisfy the audit/compliance gates or authorize a broadcast.

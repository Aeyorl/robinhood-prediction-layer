# Poku governance transfer to MAG7

Status: prepared and read-only simulated; not signed, scheduled or broadcast.

Use the existing Safe `0x5A205159348BBe6c4A5a264B59fC8Df7A4ab6a39` on chain 4663. Import `schedule.json` into Safe Transaction Builder. Confirm the transaction calls Poku timelock `0x96aC6E8964bdDA7604520B868d60B49FfA9e6ad4`, with zero ETH value and `scheduleBatch` containing seven `transferOwnership` calls. Each new owner must be MAG7 timelock `0xBC8A2ac01AeEb849A15825e9FA12ebFBe83Dd8d8`.

Two Safe owners must approve and execute the scheduling transaction. Its execution starts the 172800-second delay. Signing alone does not start the delay. The batch does not transfer tokens, create markets, or enable trading; network gas still applies.

Operation ID: `0x103fa5b7eb208b4768e80ad2d1bd39d2c1b1f11c5f5b5ea39fb7a801ebc3903f`.

After the onchain operation is ready, recheck all seven owners and destination Safe roles, then import `execute-after-delay.json` and approve/execute through the same Safe. Do not execute this file before readiness. Execution transfers ownership atomically; these contracts use one-step Ownable, so no acceptOwnership call follows.

Verify every owner equals MAG7's timelock after execution. Retain the transaction hashes and receipt blocks. Subsequent Poku configuration must be scheduled through MAG7's timelock. Reversing the transfer requires another authorized timelock operation; do not assume instant rollback.

`verification.json` records the checked block and simulations. Individual transfer calls were simulated from the current owner and scheduling from the Safe. Execution after the delay has not been simulated or broadcast. Regenerate before signing with `node scripts/prepare-mag7-governance-transfer.mjs`; it fails if ownership, delay, Safe threshold or required roles differ.

After governance transfer: refresh the expired first-market terms, configure the oracle through MAG7 governance, create the market after the required delay, connect the production API/indexer and wallet UI, and verify the entry/resolution/claim lifecycle before public trading. This ownership transfer alone does not open trading.

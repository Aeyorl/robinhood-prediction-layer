# Phase 7 routing decision

The implemented path is a non-upgradeable `PredictionEntryRouter`. A user grants an exact ERC-20 allowance and then submits one atomic transaction that swaps into USDG and enters a factory-created market. The router accepts only governance-allowlisted swap targets, checks the canonical market and collateral, enforces deadline and minimum output, clears allowances, refunds unused input, and emits source-token attribution onchain. The browser therefore needs two confirmations: approval and routed entry.

ERC-4337 and gas sponsorship are deferred. They introduce bundler availability, paymaster policy, denial-of-service and sponsor-budget risks before the product has operating data. Permit2 is also deferred until its chain deployment, typed-data UX and production swap integration are independently audited. These may reduce the flow to one signature or sponsored transaction later, but none is required for a safe v0.

The legacy swap/approve/enter flow remains available only when no router address is configured. Its attribution stays explicitly labelled `SESSION_CORRELATED`; router entries are `ONCHAIN`.

## Production requirements

- Deploy the immutable router with the canonical USDG and factory addresses.
- Make the protocol timelock its owner.
- Allowlist only the audited swap router through a delayed Safe proposal.
- Simulate calldata against a mainnet fork and confirm zero residual balances and allowances.
- Publish verified source and deployment addresses before enabling the UI.

# Prediction Layer mainnet audit candidate scope

Release tag: `prediction-layer-mainnet-audit-rc1`

The tag identifies the exact candidate commit. `ARTIFACTS.sha256` binds the first-party source, configuration, tests, ABI exports, workflows, lockfile and review documents supplied to reviewers.

## In scope

- `packages/contracts/src/**`
- `packages/contracts/script/Deploy.s.sol`
- `packages/contracts/test/**`
- `packages/contracts/abi/**`
- `packages/contracts/foundry.toml` and dependency lock/remapping files
- `packages/sdk/src/**`
- `packages/chain-config/src/**`
- Browser transaction construction and production gates under `apps/**`
- Mainnet preflight, monitoring and load scripts under `scripts/**`
- Deployment workflow under `.github/workflows/**`
- Product, oracle, deployment, governance, compliance and security documentation

## Priority review areas

1. Pool solvency, rounding, claim/refund exclusivity and fee accounting.
2. State transitions, entry deadlines, cancellation conditions and pause behavior.
3. Exact-transfer collateral enforcement and non-standard ERC-20 behavior.
4. `PredictionEntryRouter` target allowlisting, calldata controls, slippage, residual balances and reentrancy.
5. Data Streams RWA Advanced v11 payload verification, schema binding, validity interval, report expiry, market status, timestamp policy and config hash freeze.
6. Push-feed resolver limitations and separation from scheduled-time production markets.
7. Safe/timelock roles, deployer separation, immutable fee recipient and deployment sequence.
8. Browser/API/worker trust boundaries, signed attribution, secret handling and fail-closed release gates.

## Exclusions and open release blockers

- This package is an internal pre-audit candidate, not an independent audit report.
- Authenticated Data Streams report retrieval and production v11 stream IDs are not yet configured.
- External audit/retest and counsel approvals are unsigned.
- Safe hardware custody/recovery attestations are incomplete.
- No production contracts have been broadcast from this candidate.
- No claim is made that the product is legally approved, audited, or ready to accept funds.

Reviewers must report the exact tag and full commit SHA, methods, exclusions, severity-ranked findings, remediation commits, retest result, report hash, qualifications and signature.

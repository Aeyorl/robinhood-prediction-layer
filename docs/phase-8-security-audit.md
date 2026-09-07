# Phase 8 security audit

## Executive summary

This repository review covered the Solidity market, oracle, fee, factory, and entry-router paths; API and worker trust boundaries; browser transaction construction; production configuration; deployment controls; dependencies; and operational documentation. The updated 2026-09-07 review and remediation record is in `mainnet-preaudit-2026-09-07.md`. Local unit, integration, fuzz and invariant checks provide useful pre-audit evidence, but this is not an independent credentialed audit and does not authorize handling mainnet funds.

The code now has an atomic entry router, onchain funding attribution, a two-day Safe-controlled timelock deployment design, fail-closed production configuration, API rate limits, security headers, metrics, and a load-test harness. Mainnet remains blocked until the external audit and remediation, counsel/compliance approval, official production addresses and oracle parameters, Safe membership, monitoring destinations, and production load results are recorded.

## Scope and limitations

Reviewed source is the current repository working tree on 2026-09-05. Testing is local and uses mocks or Anvil. No mainnet or third-party system was probed. Deployment addresses, vendor contracts, legal conclusions, Safe signers, alert destinations and production capacity are outside this review.

## Findings

| ID    | Severity             | Status            | Finding                                                                        |
| ----- | -------------------- | ----------------- | ------------------------------------------------------------------------------ |
| PL-01 | Critical launch gate | Open              | Independent smart-contract audit and remediation are incomplete                |
| PL-02 | High                 | Open              | Production oracle, sequencer feed and canonical addresses are unverified       |
| PL-03 | High                 | Open              | Safe signers and timelock deployment have not been established onchain         |
| PL-04 | High                 | Open              | Counsel-approved eligibility, terms, privacy and sanctions controls are absent |
| PL-05 | Medium               | Mitigated in code | Atomic routing must constrain arbitrary external calls and approvals           |
| PL-06 | Medium               | Mitigated in code | API abuse and unsafe production defaults could degrade availability            |
| PL-07 | Medium               | Open              | Production alerting and capacity evidence are not yet available                |
| PL-08 | High                 | Mitigated in code | Scheduled-time resolution previously used a later live push-feed price         |
| PL-09 | Medium               | Mitigated in code | Arithmetic edge cases could block settlement or payout                         |
| PL-10 | Medium               | Mitigated in code | Collateral accounting trusted the requested transfer amount                    |
| PL-11 | High                 | Open              | Production Data Streams retrieval and exact stream policy are not commissioned |

## Detailed findings

### PL-01 — external audit missing

- **Location:** all contracts, especially `BinaryPoolMarket` and `PredictionEntryRouter`
- **Attack scenario:** an undiscovered accounting, oracle, token-behaviour or external-call defect is exploited after deposits begin.
- **Impact:** loss or lock of user funds and incorrect settlement.
- **Likelihood:** medium until independent review is complete.
- **Remediation:** commission an independent audit, remediate every accepted issue, rerun the suite, publish the report and record approval using the production gate.
- **References:** OWASP SCSTG; CWE-682; SWC registry classes.

### PL-02 — production chain inputs unverified

- **Location:** deployment environment, oracle registry configuration and chain config.
- **Attack scenario:** a wrong collateral, swap router, price feed, heartbeat or sequencer feed is configured.
- **Impact:** bad pricing, failed resolution, or funds sent through the wrong integration.
- **Likelihood:** high if copied without live verification.
- **Remediation:** verify each address from two official sources, checksum it, fork-test it, and record the block number and approver in the deployment manifest.
- **References:** OWASP SC02 and SC08; CWE-345.

### PL-03 — governance not deployed

- **Location:** `ProtocolTimelock` and `Deploy.s.sol`.
- **Attack scenario:** a compromised or mistaken owner changes oracle settings, pauses markets, or allowlists a malicious swap target.
- **Impact:** denial of service or routed-token loss.
- **Likelihood:** medium before Safe ceremony.
- **Remediation:** establish signer identities and threshold, deploy the two-day timelock, verify roles, transfer ownership, execute a rehearsal, and remove deployer privileges.
- **References:** OWASP SC01; CWE-284.

### PL-04 — compliance approval absent

- **Location:** product eligibility and production launch process.
- **Attack scenario:** prohibited users or jurisdictions access a real-money prediction product, or required disclosures are missing.
- **Impact:** regulatory, sanctions and consumer-protection exposure.
- **Likelihood:** jurisdiction-dependent and unresolved.
- **Remediation:** obtain qualified counsel, implement the approved policy, test fail-closed enforcement, version user acceptance, and retain evidence. Engineering must not invent the policy.
- **References:** applicable counsel-approved rules and sanctions programs.

### PL-05 — router external-call boundary

- **Location:** `PredictionEntryRouter.enterWithToken`.
- **Attack scenario:** user-controlled calldata targets a malicious adapter or leaves token allowances/balances behind.
- **Impact:** router-held tokens could be stolen or attribution forged.
- **Likelihood:** low after controls, high if governance allowlists an unsafe target.
- **Remediation:** implemented factory/collateral validation, target allowlist, exact measured input approval, allowance clearing, balance-delta minimum output, refund, reentrancy guard and atomic rollback. External audit and fork simulation remain required.
- **References:** OWASP SC05 and SC06; CWE-841.

### PL-06 — API availability controls

- **Location:** API server and configuration loader.
- **Attack scenario:** abusive request volume exhausts process/database resources or a mainnet service starts with local/insecure settings.
- **Impact:** quote, market and indexing availability loss.
- **Likelihood:** reduced by global and route-specific rate limits.
- **Remediation:** implemented Redis-backed global throttling, small bodies, security headers, proxy-aware production mode and fail-closed mainnet variables. Tune from production load data.
- **References:** OWASP API4:2023; CWE-770.

### PL-07 — operational proof pending

- **Location:** production monitoring and infrastructure.
- **Attack scenario:** RPC degradation, indexer lag, elevated server errors or database exhaustion goes unnoticed.
- **Impact:** stale UI, delayed attribution and operational outage.
- **Likelihood:** medium until alerts are connected.
- **Remediation:** run the checked-in load test against staging, connect `/metrics` and RPC/indexer lag to paging, exercise the incident runbook, and retain results.
- **References:** OWASP API availability guidance; CWE-778.

## Trust boundaries and external calls

Wallets authorize ERC-20 approvals and market/router transactions. The API supplies quotes but cannot sign or broadcast. The router calls one governance-allowlisted swap target, then one factory-created market; it measures token deltas rather than trusting adapter return data. Markets pull canonical collateral and call the resolver during settlement. The resolver reads registry-selected feeds and fails closed on stale, incomplete, paused or unhealthy data. The worker treats chain logs as canonical and labels session correlation separately.

Core invariants are: user principal has no admin withdrawal path; claims/refunds remain available while paused; one position cannot claim twice; market terms are immutable; credited stakes match collateral received; fees are bounded and charged on profit; router balances and allowances return to their pre-call state; and onchain attribution must match user, market, side and USDG amount in the same transaction.

## Remediation roadmap

1. External audit and tracked remediation.
2. Counsel-approved compliance implementation and acceptance tests.
3. Verify production RPC, collateral, swap router, feeds and sequencer parameters.
4. Safe signer ceremony, timelock deployment, role/ownership verification and rehearsal.
5. Staging load test, dashboards, paging and incident exercise.
6. Final name, trademark and Robinhood brand-guideline review.

## Appendix

Evidence commands are `forge test`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm format:check`, `pnpm test:e2e`, and `pnpm test:load`. Record commit, tool versions, environment, result and timestamp for each release candidate.

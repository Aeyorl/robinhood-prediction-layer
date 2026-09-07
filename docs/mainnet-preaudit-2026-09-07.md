# Wagerly mainnet pre-audit — 2026-09-07

## 1. Executive summary

This review covered the Solidity market, factory, routing, fee, governance and oracle paths; the browser transaction boundary; API and worker controls; deployment workflow; production configuration; dependency state; and operational evidence. A release-blocking error was found in the scheduled-time oracle design: the push-feed resolver accepted a reference timestamp but returned the latest value. The candidate now includes a Chainlink Data Streams RWA Advanced v11 resolver that cryptographically verifies a signed report and binds its feed, validity interval, market status and price timestamp to the market's immutable resolution terms.

The reviewed local suite passes, but this document is an internal pre-audit hardening record. It is not an independent credentialed audit and does not authorize mainnet deployment or user funds. Mainnet remains **NO-GO** until the open gates below are closed with signed external evidence.

## 2. Scope and limitations

- **In scope:** first-party source and configuration in this repository, including every contract under `packages/contracts/src`, deployment scripts, GitHub Actions, web transaction construction, API/worker trust boundaries and production runbooks.
- **Dynamic coverage:** local Foundry unit, integration, fuzz and invariant tests; monorepo lint, build, type checks and application tests; no-broadcast mainnet-state deployment simulation.
- **Dependency coverage:** production pnpm advisory scan and pinned lockfile review. Slither, Semgrep and Gitleaks were unavailable locally; targeted pattern and secret searches were used and this limitation is disclosed to the external reviewer.
- **Excluded:** destructive or exploit testing against mainnet; custody inspection of signer hardware; private keys; legal conclusions; Chainlink account access; signed Data Streams production payloads; external audit opinion; AWS/Vercel capacity evidence that requires a live deployed application.
- **External sources:** Chainlink's current Data Streams EVM verification and RWA v11 schema documentation were used to validate the integration shape. The production stream IDs, decimals and session policy still require authenticated account evidence and reviewer acceptance.

## 3. Findings summary

| ID    | Severity             | Title                                                                | Location                                             | Status                               |
| ----- | -------------------- | -------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------ |
| PL-01 | Critical launch gate | Independent audit and remediation absent                             | Entire contract system                               | Open                                 |
| PL-04 | High                 | Counsel-approved eligibility and compliance policy absent            | Product and API enforcement                          | Open                                 |
| PL-07 | Medium               | Production paging and load evidence incomplete                       | AWS runtime/monitoring                               | Open                                 |
| PL-08 | High                 | Scheduled-time resolver used a later live price                      | `ChainlinkPriceResolver`, `BinaryPoolMarket.resolve` | Remediated; external retest required |
| PL-09 | Medium               | Arithmetic edge cases could block settlement or payout               | `BinaryPoolMarket`, `MarketFactory`                  | Remediated; external retest required |
| PL-10 | Medium               | Collateral accounting trusted requested transfer amount              | `BinaryPoolMarket._enter`                            | Remediated; external retest required |
| PL-11 | High                 | Production Data Streams retrieval and stream policy not commissioned | API/worker, resolver configuration                   | Open                                 |
| PL-12 | High                 | Wagerly signer ceremony evidence incomplete                 | Safe/timelock operations                             | Open                                 |

## 4. Detailed findings

### [CRITICAL] PL-01 — independent audit and remediation absent

- **Location:** all contracts, especially `BinaryPoolMarket`, `PredictionEntryRouter` and `DataStreamsRwaResolver`
- **Category:** Release assurance
- **Description:** The code has not received an independent, signed security assessment bound to this exact release candidate.
- **Attack scenario:** A defect missed by the internal review is deployed, an attacker selects an edge-case transaction or oracle report, and user collateral is lost or locked before operators can react.
- **Impact:** Potential protocol-wide loss or lock of user funds and incorrect market settlement.
- **Likelihood:** Medium before independent review because the system combines pooled accounting, external token calls, swap calldata and oracle verification.
- **Recommendation:** Commission an independent audit against the immutable candidate tag, remediate every accepted finding, obtain a signed retest, and create a new candidate if any audited input changes.
- **References:** OWASP SCSVS; CWE-682; SWC classes.

### [HIGH] PL-04 — counsel-approved policy absent

- **Location:** eligibility, market access, terms, privacy and sanctions enforcement
- **Category:** Compliance and authorization
- **Description:** Engineering has a review pack but no qualified-counsel decision defining permitted jurisdictions, users, controls or disclosures.
- **Attack scenario:** A prohibited or ineligible user accesses a real-money prediction market, or the interface presents terms that do not match the operator's legal obligations.
- **Impact:** Regulatory, sanctions, consumer-protection and operational exposure.
- **Likelihood:** Jurisdiction-dependent and unresolved.
- **Recommendation:** Counsel must supply a signed, versioned policy. Implement its exact controls, bind acceptance to wallet and version, and test fail-closed behavior before changing the compliance gate.
- **References:** Counsel-selected applicable law and sanctions programs.

### [HIGH] PL-08 — scheduled-time resolver used a later live price

- **Location:** previous `ChainlinkPriceResolver.resolve`; `BinaryPoolMarket.resolve`
- **Category:** Oracle integrity / business logic
- **Description:** The previous resolver ignored `referenceTime` and returned `latestRoundData`. A later resolver transaction could use a price from after the market's stated timestamp.
- **Attack scenario:** A market is close to its strike at 4:00 PM. A caller waits for a favorable later price and then resolves, causing the opposite side to receive the pool.
- **Impact:** Incorrect settlement and direct redistribution of the full losing pool.
- **Likelihood:** Practical whenever the price crosses the strike after the stated resolution time.
- **Recommendation:** Implemented `DataStreamsRwaResolver` for scheduled equity markets. It verifies a signed RWA v11 report through the canonical verifier and requires the configured feed, schema, validity interval containing `resolutionTime`, report expiry, expected session, positive mid price and bounded price timestamp. Do not use the push-feed resolver for scheduled-time mainnet questions. External auditors must retest this design and the report-fetch path.
- **References:** CWE-345; OWASP SC02; Chainlink Data Streams onchain verification responsibilities.

### [HIGH] PL-11 — production Data Streams path not commissioned

- **Location:** resolver configuration and offchain report retrieval
- **Category:** Oracle operations / availability
- **Description:** The onchain verifier path exists, but authenticated Data Streams credentials, exact v11 stream IDs, decimals, expected market session, retrieval redundancy and keeper behavior are not configured or proven.
- **Attack scenario:** A wrong stream/session is configured or no valid unexpired report is retrieved at the market boundary, preventing normal resolution and requiring delayed governance cancellation.
- **Impact:** Incorrect configuration can block resolution; an availability failure can lock collateral until timelock cancellation and refunds.
- **Likelihood:** High if production markets are created before a rehearsal with real signed payloads.
- **Recommendation:** Create the Data Streams account outside the repository, store credentials in AWS Secrets Manager, verify each stream through official discovery, implement redundant REST/WebSocket retrieval, rehearse a signed v11 resolution on a local fork, monitor expiry and lag, and retain the payload hash and receipt. Never log credentials or full authenticated responses.
- **References:** CWE-345; CWE-400; Chainlink Data Streams developer responsibilities.

### [HIGH] PL-12 — signer ceremony evidence incomplete

- **Location:** shared Safe and deployment procedure
- **Category:** Key management / governance
- **Description:** The 2-of-3 Safe and a prior MAG7 rehearsal are verified onchain, but Wagerly lacks signed hardware-wallet custody, recovery contact and ceremony records.
- **Attack scenario:** A signer device is unavailable or compromised during an incident, and operators cannot prove or execute the intended threshold process.
- **Impact:** Delayed emergency response or unauthorized governance if custody assumptions are false.
- **Likelihood:** Unknown until each signer attests.
- **Recommendation:** Complete the checked-in ceremony record with each signer, verify chain ID and release hashes independently, execute the harmless delayed rehearsal after deployment, and retain receipts.
- **References:** CWE-320; NIST key-management principles.

### [MEDIUM] PL-09 — arithmetic edge cases could block settlement or payout

- **Location:** `BinaryPoolMarket.previewPayout`, `_evaluate`; factory/market timeout validation
- **Category:** Arithmetic / denial of service
- **Description:** Multiplication in payout and decimal normalization could overflow for extreme inputs, and `resolutionTime + gracePeriod` was not explicitly bounded.
- **Attack scenario:** A misconfigured or malicious oracle produces extreme decimals/value, or extreme market terms are created, making settlement or timeout cancellation revert permanently.
- **Impact:** Bounded market fund lock requiring governance cancellation, or inability to preview/claim an extreme payout.
- **Likelihood:** Low with canonical USDG and reviewed feeds; material as defense against configuration error.
- **Recommendation:** Implemented 512-bit `Math.mulDiv`, bounded oracle decimals, overflow-aware decimal comparison and explicit deadline-overflow validation. Retain boundary tests and external review.
- **References:** CWE-190; SWC-101; CWE-400.

### [MEDIUM] PL-10 — collateral accounting trusted requested amount

- **Location:** `BinaryPoolMarket._enter`
- **Category:** Token integration / solvency
- **Description:** Pool and user balances previously increased by the requested amount without verifying how much collateral the contract actually received.
- **Attack scenario:** A fee-on-transfer or otherwise non-standard token is mistakenly configured as collateral; entries are overcredited and later claim/refund transfers become insolvent.
- **Impact:** Insolvency for the affected market.
- **Likelihood:** Low for canonical USDG but high after a collateral-address configuration mistake.
- **Recommendation:** Implemented an exact pre/post balance-delta requirement. Only canonical reviewed collateral may be configured.
- **References:** CWE-682; OWASP SC05.

### [MEDIUM] PL-07 — production paging and load evidence incomplete

- **Location:** AWS monitoring stack, alert subscriptions and staging evidence
- **Category:** Detection and availability
- **Description:** Dashboards and alarms exist, but there is no confirmed production paging destination or application load result from a deployed staging runtime.
- **Attack scenario:** RPC, indexer, API or database degradation continues unnoticed or exceeds capacity when users arrive.
- **Impact:** Stale market state, missed report windows and service outage.
- **Likelihood:** Medium until the deployed runtime is exercised.
- **Recommendation:** Confirm the named on-call subscription, deploy the audited SHA to a non-public staging runtime, run the load harness, exercise incident response and retain metrics/log evidence.
- **References:** CWE-778; OWASP API4.

## 5. Trust-boundary map

| Boundary             | From                               | To              | Verification                                                   | Risk if unverified                     |
| -------------------- | ---------------------------------- | --------------- | -------------------------------------------------------------- | -------------------------------------- |
| Wallet transaction   | User wallet                        | Market/router   | Chain ID, fixed addresses, decoded calldata, bounded approvals | Wrong-chain or malicious-call signing  |
| Funding token        | ERC-20                             | Entry router    | Measured source and USDG balance deltas, cleared allowances    | Overcredit or stolen residual approval |
| Market identity      | Router                             | Market          | Factory membership and canonical collateral                    | Attribution to attacker contract       |
| Signed price report  | Data Streams API                   | Resolver        | Canonical verifier, v11 schema, feed/time/status/age checks    | Forged or wrong-time settlement        |
| Oracle configuration | Safe/timelock                      | Resolver        | Two-day delay and snapshotted config hash                      | Silent market-term substitution        |
| Chain events         | RPC                                | Worker/Postgres | Canonical event identity and reorg-aware cursor                | Stale or double-counted projections    |
| Deployment secret    | Secrets manager/GitHub environment | Manual workflow | Protected environment, address derivation, preflight           | Key disclosure or wrong deployer       |

## 6. Invariant and external-call register

Core invariants reviewed:

1. Market principal has no admin withdrawal path.
2. Pool credits equal collateral actually received.
3. Claims/refunds remain callable while entry is paused.
4. A wallet cannot claim or refund twice.
5. Total winner payouts plus fees never exceed market collateral.
6. Scheduled-time resolution uses a verified report bound to immutable feed and timestamp terms.
7. Router approvals are exact and cleared in the same atomic transaction.
8. Every privileged protocol action is owned by the new two-day timelock, with the shared Safe as proposer/executor.

| Function                               | External target             | Protection                                  | Return/value handling                                   |
| -------------------------------------- | --------------------------- | ------------------------------------------- | ------------------------------------------------------- |
| `BinaryPoolMarket._enter`              | Canonical collateral        | `nonReentrant`, exact balance delta         | SafeERC20; rejects non-exact receipt                    |
| `claim` / `refund`                     | Canonical collateral        | checks-effects-interactions, `nonReentrant` | SafeERC20; claim flag set first                         |
| `PredictionEntryRouter.enterWithToken` | Allowlisted swap target     | `nonReentrant`, deadline, exact approval    | Call success checked; deltas enforced; approval cleared |
| `PredictionEntryRouter.enterWithToken` | Factory market              | factory membership and collateral check     | Atomic revert; USDG approval cleared                    |
| `DataStreamsRwaResolver.resolve`       | Canonical verifier proxy    | immutable proxy, schema/feed/time checks    | Verified response decoded as v11                        |
| `ChainlinkPriceResolver.health`        | Configured feed/token state | try/catch and fail-closed flags             | Invalid/unreadable inputs are unhealthy                 |

## 7. Recommendations roadmap

1. Freeze and commission the exact audit candidate; complete independent findings and retest.
2. Commission counsel and implement the signed policy with acceptance tests.
3. Configure authenticated Data Streams retrieval and rehearse real v11 payload verification without user funds.
4. Complete signer custody/recovery ceremony evidence.
5. Deploy the audited SHA, verify bytecode/ownership, execute timelock rehearsal and keep market creation disabled.
6. Complete staging load, paging, backup/restore and incident exercises.
7. Re-run preflight and deployment simulation, then request the final explicit broadcast approval.

## 8. Appendix — evidence commands

Latest candidate verification on 2026-09-07:

- `forge test -vv`: 95 passed, 0 failed (unit, integration, 500-run fuzz cases and 64-run invariant).
- `pnpm test`: 42 root Vitest tests plus all package tests passed.
- `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:tests`, `pnpm format:check` and `pnpm build`: passed.
- `pnpm audit --prod --audit-level=high`: no known production dependency vulnerabilities.
- Mainnet preflight with unsigned review gates: failed closed before any RPC or transaction action.
- Mainnet-state deployment simulation at block `56515075`: completed without `--broadcast`; estimated `10,580,149` gas and `0.007454265148828149 ETH`.
- Browser E2E was not repeated for this contract-only hardening candidate; the last saved browser evidence predates these changes and is not a substitute for production Data Streams rehearsal.

- `forge test -vv`
- `pnpm audit --prod --audit-level=high`
- `pnpm lint`
- `pnpm build`
- `pnpm typecheck`
- `pnpm test`
- `pnpm format:check`
- `pnpm test:e2e`
- `pnpm mainnet:preflight` with gates intentionally false (must fail closed)
- `forge script script/Deploy.s.sol:Deploy` against mainnet state without `--broadcast`

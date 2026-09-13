# External review commissioning pack

Status: **prepared for reviewers; no external approval has been received**.

## Independent smart-contract audit

Scope the deployed release commit and all Solidity under `packages/contracts`, with emphasis on `BinaryPoolMarket`, `PredictionEntryRouter`, `DataStreamsRwaResolver`, the push-feed registry/resolver, fee accounting, factory authorization, timelock ownership, cancellation/refund behavior, token edge cases and adapter/verifier external calls. Reviewers should challenge the RWA v11 decoding, report-schema binding, validity-window and market-session rules, price timestamp policy, config-hash freeze and the operational report-fetch path. Reviewers should receive the build toolchain, dependency lockfile, deployment script, local test evidence and intended production address manifest.

The accepted deliverable must identify the auditor and firm, qualifications, exact commit, scope, exclusions, methods, finding severities, remediation status, retest result, report hash, signature and completion date. Every accepted finding must link to a fix commit or a signed risk acceptance. (2026-09-13: the external-audit launch gate `MAINNET_EXTERNAL_AUDIT_APPROVED` was removed at the project owner's request; an independent audit is no longer a launch requirement, so this pack is optional until a review is commissioned.)

## Legal and compliance review

Use `compliance-review-pack.md` as the engineering description. Counsel must supply the permitted entity and jurisdictions, excluded users and locations, age/identity requirements, sanctions and wallet-screening rules, classification and licensing conclusions, disclosures, consent text, privacy roles, retention periods, tax/reporting duties and dispute terms.

The accepted record must name counsel, firm, qualifications, jurisdictional scope, policy version, effective date, signed advice reference and the exact product copy and enforcement rules engineering must implement. (2026-09-13: compliance approval is owner-provided and is recorded by `MAINNET_COMPLIANCE_APPROVED=true`; a counsel review, if commissioned later, supersedes it.)

## Release record

Record these fields together so approval cannot drift from the released code:

| Field             | Required value                                                     |
| ----------------- | ------------------------------------------------------------------ |
| Release commit    | Full Git SHA                                                       |
| Contract build    | Compiler and dependency versions                                   |
| Audit             | Signed report hash and retest result                               |
| Compliance        | Signed advice reference and policy version                         |
| Production inputs | RPC, USDG, router, oracle and sequencer evidence                   |
| Governance        | Safe, signers, threshold, timelock and rehearsal transactions      |
| Operations        | Monitoring subscriptions, staging load evidence and incident owner |

Until independent reviewers fill and sign these records, the repository documentation remains preparation evidence only.

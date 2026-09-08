# Safe closing-price resolver internal pre-audit

Date: 2026-09-08

Scope: `SafeClosingPriceResolver`, its market timeout integration, evidence generator, worker event monitoring and admin status surface.

This is an internal pre-deployment security review. It is not an independent audit, legal review, certification or mainnet approval.

## Findings

### PL-SR-01 — High — governance controls the reported closing price

The timelock owner can publish any positive price that satisfies timing constraints. The evidence hash, public URI, independent-source procedure and challenge period make proposals reviewable but do not cryptographically prove the price. A compromised Safe or colluding signers could schedule a false observation.

Required remediation before launch: independent review of the contract and operating procedure; documented signer independence; transaction simulation; evidence review by a second operator; monitoring for every proposal; and a tested guardian cancellation runbook. Status: open external dependency.

### PL-SR-02 — Medium — public-source availability and licensing are operational dependencies

The free path depends on public closing-price sources remaining accessible and legally usable. A source can change format, correct a close later, or become unavailable.

Required remediation before launch: counsel-approved source policy; two independent sources; archived evidence; correction handling; source fallback list; and no observation when sources disagree. Status: open external dependency.

### PL-SR-03 — Medium — guardian cancellation can delay settlement

The guardian can cancel during the challenge period. This cannot choose a winner, but it can force timeout cancellation and refunds. Compromise or misuse creates availability and trust risk.

Mitigation present: immutable guardian, bounded challenge window, emitted cancellation event, worker alert, and permissionless timeout refund. Required remediation: signer ceremony, monitored Safe policy and incident exercise. Status: open operational dependency.

### PL-SR-04 — Remediated — missing observation previously appeared healthy

The resolver's general health method cannot express whether a specific reference timestamp has an observation. Before this review, a missing observation could leave timeout cancellation blocked because the resolver remained generally healthy.

Remediation: the resolver now exposes `resolutionAvailable(assetKey, referenceTime)`. The market optionally checks this status after its grace period. Missing or cancelled observations allow permissionless cancellation; a valid pending observation prevents bypass of the challenge period. Status: remediated with contract tests.

## Residual decision

The implementation is suitable for continued review and rehearsal. Mainnet remains NO-GO until the independent audit, counsel approval, signer ceremony, verified production addresses, monitoring destinations and capped-canary plan have signed evidence.

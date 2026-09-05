# Compliance review pack

Status: **draft for qualified counsel; not legally approved**.

The application is a non-custodial binary prediction interface on Robinhood Chain. Users sign approvals and market transactions from their own wallets. Markets lock at a disclosed time and resolve from configured oracle data. There is no early exit in v0. Winners share the losing pool pro rata after a fee on profit. Delayed governance can pause new entries or cancel, but cannot withdraw market principal; pause does not block claims or refunds.

Counsel must identify the permitted operator entity and jurisdictions; excluded persons and locations; age and identity requirements; sanctions and wallet-screening rules; product classification and licences; marketing, tax and reporting duties; dispute venue; privacy roles; retention periods; and exact Terms, Privacy Notice, Risk Disclosure and consent language.

The approved policy must be versioned and effective-dated. Eligibility must be checked before quote and entry, fail closed when unavailable, and bind acceptance to wallet, policy version and timestamp with data minimisation. Provider secrets remain server-side. Admin overrides require a reason and audit log. Claims and refunds remain available unless counsel explicitly requires a lawful restriction that engineering validates separately.

Approval evidence must name counsel, firm, jurisdictional scope, policy version, date and qualifications. `MAINNET_COMPLIANCE_APPROVED=true` may be set only after that evidence is stored in the release record.

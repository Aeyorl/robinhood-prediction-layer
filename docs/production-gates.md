# Production gates

Mainnet activation is fail closed. The API refuses production mode on chain 4663 unless HTTPS RPC, production CORS, Uniswap credentials, the entry router, external-audit approval and compliance approval are explicitly configured.

Before activation, attach evidence for: an independent audit and remediation; counsel-approved jurisdiction, eligibility, sanctions, terms, privacy and data-retention rules; verified checksummed contract/RPC/oracle addresses; either reviewed Safe closing-price evidence operations or production Chainlink Data Streams credentials and stream IDs; Safe signers and threshold; two-day timelock roles and ownership; source verification; staging fork/canary results; load-test latency/error results; database backup/restore; dashboards and paging; incident rehearsal; final product name/trademark and current Robinhood brand-guideline review.

The zero-subscription closing-price path requires two matching independent public sources, a corporate-action check, an immutable evidence URI, a generated evidence hash and Safe transaction, and an elapsed challenge period. The worker must alert on every proposal and cancellation. This operational path still requires independent contract review and counsel approval before user funds are accepted.

The environment approval flags record completed reviews; they are not substitutes for those reviews. No engineer should set either flag without the referenced evidence and named approver.

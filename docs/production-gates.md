# Production gates

Mainnet activation is fail closed. The API refuses production mode on chain 4663 unless HTTPS RPC, production CORS, Uniswap credentials, the entry router, external-audit approval and compliance approval are explicitly configured.

Before activation, attach evidence for: an independent audit and remediation; counsel-approved jurisdiction, eligibility, sanctions, terms, privacy and data-retention rules; verified checksummed contract/RPC/oracle addresses; either reviewed Safe closing-price evidence operations or production Chainlink Data Streams credentials and stream IDs; Safe signers and threshold; two-day timelock roles and ownership; source verification; staging fork/canary results; load-test latency/error results; database backup/restore; dashboards and paging; incident rehearsal; final product name/trademark and current Robinhood brand-guideline review.

The zero-subscription closing-price path requires two matching independent public sources, a corporate-action check, an immutable evidence URI, a generated evidence hash and Safe transaction, and an elapsed challenge period. The worker must alert on every proposal and cancellation. This operational path still requires independent contract review and counsel approval before user funds are accepted.

The environment approval flags record completed reviews; they are not substitutes for those reviews. No engineer should set either flag without the referenced evidence and named approver.

Ceremony evidence gate (added 2026-09-08): the recorded Safe ceremony signatures are not independently reproducible and bind `prediction-layer-mainnet-audit-rc1` rather than the deployed candidate (`docs/internal-security-review-2026-09-08.md`, ISR-01/ISR-02). Before deployment authorization, at least two owners must re-sign a schema-valid EIP-712 payload naming the final release tag and commit, the artifact manifest must be regenerated from blob content so it verifies on every platform, and an independent verifier must reproduce the signature check from repository contents alone.

# Security

## Threat model summary

- Malicious actors cannot move user principal: markets have no admin-withdrawal path; fees go to a `FeeVault` whose withdraw target is immutable; pause never blocks claims/refunds.
- Resolution cannot be gamed by admins (permissionless deterministic resolver) or by stale/oracle-down states (health checks).
- Double payout is impossible: `hasClaimed` gates both claims and refunds, enforced by tests and invariant checks.
- Reentrancy is mitigated with OpenZeppelin `ReentrancyGuard` on value-moving functions and `SafeERC20` everywhere.
- Market terms are frozen at creation (immutables) — existing markets can never be edited after the fact.

## Contract rules (enforced)

- No arbitrary admin withdrawal of principal.
- No arbitrary swap-call target (router allowlist server-side + config-driven).
- Fee ≤ 10% hard cap; fee charged on profit only.
- Pause blocks new entries but never claims/refunds.
- Token identity is `(chainId, address)`; symbols are never trusted.
- Solvency preserved via floor rounding (dust ≤ number of winners stays in the contract).

## Environment / repo

- No private keys in the repository or in browser env vars. `.env*` is gitignored; `.env.example` files contain placeholders only.
- CI runs lint, typecheck, build, Foundry tests, and format checks on every PR. There is no deployment on normal PRs.
- Mainnet deployment is a separate manually approved workflow (`deploy-mainnet.yml`) gated by a protected `mainnet` environment. Addresses in `@pl/chain-config` must be re-verified against official docs before that gate.

## Testing gates

- Unit + fuzz + invariant tests for contracts (60 passing).
- Frontend/API/worker tests are added per milestone (see `07_TESTING_AND_ACCEPTANCE.md`).
- Mainnet-fork tests never broadcast real transactions.

## Compliance hooks (v0 provides seams, not policy)

Optional policy interfaces/config allow production to plug in geolocation eligibility, wallet risk screening, terms acceptance, and KYC where legally required. No bypass of legal/KYC/geofence controls is implemented or documented.

## Brand rules

- "Robinhood Chain" in full — never "Hood Chain".
- No claim of Robinhood endorsement.
- "Stock Tokens" used consistently in external copy.
- Robinhood branding assets are optional/configurable and must follow current official guidelines.

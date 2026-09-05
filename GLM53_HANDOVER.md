# GLM-5.3 handover — Phases 7/8 and frontend continuation

Date: 2026-09-05 (Africa/Lagos)  
Repository: `C:\Project folder\robinhood-prediction-layer-docs`  
Branch: `main`

## Read this first

Continue from the current workspace and commits. Do not redo Phases 4–8, reset the branch, deploy mainnet, set either approval flag, or invent legal/trademark approval. Read the repository `AGENTS.md`, `C:\Users\aeyon\.codex\design.md`, `08_ROADMAP.md`, `docs/phase-8-security-audit.md`, and this file before editing. Preserve the existing minimal-diff style.

The user asked to finish compliance, production address verification, Safe/timelock deployment, monitoring/staging evidence, final naming/brand review, and then work on frontend/UI. All repository-controlled preparation is complete. The remaining production steps need external inputs or explicit mainnet release evidence.

## Current git state

The working tree was clean immediately before this handover file was created. Relevant commits:

- `98aecd3 Prepare production approvals and start compliance UI`
- `0b4a43d Complete Phase 7 routing and Phase 8 hardening`
- `e62ceaa Add reproducible Phase 6 community analytics`
- `6d68b08 Harden Phase 5 oracle resolution and refunds`
- `a828e0c Complete Phase 4 fork route-to-market gate`
- `160887e Add Phase 4 token funding and attribution`

## DONE

### Phase 7

- Added immutable `PredictionEntryRouter` with deadline/min-output checks, factory-created market validation, canonical USDG validation, governance allowlist, measured exact input approval, allowance clearing, unused-input refund, reentrancy guard, atomic rollback, and `FundingRouted` event.
- Added `BinaryPoolMarket.enterFor` so the router pays while crediting the user.
- API quote responses advertise the router as approval spender while preserving the underlying swap target/calldata.
- Web funding flow is two confirmations: exact token approval, then one atomic router transaction.
- Worker derives `ONCHAIN` attribution from a matching router event. Legacy flow remains `SESSION_CORRELATED`.
- Local deploy and E2E environment deploy/allowlist the router; ABI is exported through the SDK.
- ERC-4337, gas sponsorship, and Permit2 were deliberately deferred; rationale is in `docs/phase-7-routing.md`.

### Phase 8 repository controls

- Added `ProtocolTimelock`, fixed at two days, with a Safe as sole proposer/executor/canceller and no external admin.
- Production deploy script creates core contracts and router owned by the timelock.
- API mainnet production mode fails closed unless HTTPS RPC, production CORS, Uniswap/API key, router, external-audit approval, and compliance approval are configured.
- Added global Redis-backed API rate limit, security headers, `/metrics`, incident runbook, production gates, load test, and monitor runner.
- Detailed pre-audit report exists at `docs/phase-8-security-audit.md`. It is not an independent credentialed audit.

### Production verification

- Official/live chain ID: `4663`.
- Official public RPC: `https://rpc.mainnet.chain.robinhood.com` (rate-limited; not intended as production provider).
- Official recommended provider pattern: `https://robinhood-mainnet.g.alchemy.com/v2/{API_KEY}` and matching WSS.
- Canonical USDG: `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`; live deployed code confirmed.
- Uniswap Universal Router 2.1.1: `0x8876789976decbfcbbbe364623c63652db8c0904`; confirmed by official Uniswap docs/SDK and live code.
- Chainlink Data Streams verifier: `0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7`; official Robinhood docs and live code confirmed.
- AAPL/NVDA/TSLA token/feed pairs match the live Robinhood asset API and Chainlink reference-data directory. `pnpm --filter @pl/chain-config verify:oracles` passed with positive, complete rounds and unpaused tokens.
- No official Chainlink sequencer-uptime contract address was found. Robinhood's `wss://feed.mainnet.chain.robinhood.com` is a transaction sequencer feed, not that contract. Keep `sequencerFeed: null` unless an official uptime-contract address is published.
- Evidence is in `docs/production-address-verification-2026-09-05.md`.

### Existing Safe candidate

Read-only live verification found:

- Safe: `0x5A205159348BBe6c4A5a264B59fC8Df7A4ab6a39`
- Chain: 4663
- Threshold: 2
- Nonce: 1
- Owners:
  - `0xa5e7d6C189b37D9293908E0A28Da4D65d65a7f7A`
  - `0x26032745BcB969B95B4610A9a48D33Bd4340812D`
  - `0x8cA71B70C91BD8250073dfDD323b9219Bce6A165`

Do not assume this Safe belongs to this product. Ask the user to confirm it and that the owners satisfy the ceremony record before using it in any deployment.

### Monitoring and frontend start

- `pnpm monitor:once` passed locally: DB/Redis up, zero server errors, roughly 50 ms monitor latency at the recorded run.
- `pnpm test:load` passed locally with 200 requests, concurrency 20, zero failures, p95 64 ms.
- Replaced placeholder `/terms` and `/risks` pages with responsive pre-launch information layouts. Both rendered successfully in the local browser and the production build passed.
- Robinhood brand review is in `docs/brand-review.md`; official August 2026 rules are captured without bundling or altering Robinhood logo assets.

## Verification already passed

- `forge test`: 83 passed, 0 failed.
- Funding API focused suite: 29 passed.
- Attribution suite: 8 passed.
- Routed Playwright flow: quote → exact approval → atomic entry → `ONCHAIN` attribution → resolution → payout passed.
- Repository typecheck, test typecheck, E2E typecheck, lint, tests, and production build passed.
- `pnpm audit --prod` could not run because the npm registry DNS lookup failed; retry when networking permits.
- `pnpm format:check` has a pre-existing/generated warning for `apps/web/next-env.d.ts`; changed files were formatted.

## Local runtime

The local environment was refreshed onto Anvil chain `46630` and is currently healthy. PIDs are ephemeral, so verify rather than trusting them:

- Anvil: `127.0.0.1:8545`
- Web: `http://127.0.0.1:3000`
- API: `http://127.0.0.1:3001`
- Worker: running against the new factory/router
- API `/health`: DB and Redis up
- Latest local router in ignored manifest: `packages/contracts/deployments/local.json`
- Ignored `apps/api/.env` and `apps/worker/.env` were updated with the current local addresses. Do not print or commit secrets.

## PARTIALLY DONE / externally blocked

1. **Compliance:** `docs/compliance-review-pack.md` is ready for qualified counsel. Counsel has not approved it, final jurisdiction rules are absent, and `MAINNET_COMPLIANCE_APPROVED` must remain false.
2. **External audit:** no independent credentialed audit/remediation report exists. `MAINNET_EXTERNAL_AUDIT_APPROVED` must remain false.
3. **Production RPC:** official and public endpoints are verified, but the user's private Alchemy/other production HTTP and WSS endpoints are not supplied.
4. **Safe ceremony/timelock:** contract and deployment script are ready; the existing Safe candidate needs ownership confirmation, signer-control attestation, fee recipient, audited swap target, production RPC, external audit, compliance clearance, and explicit deployment approval. Nothing was deployed to mainnet.
5. **Monitoring:** generic webhook runner and evidence format exist. The actual paging webhook/log vendor, retention policy and staging environment are not supplied. Local evidence is not staging evidence.
6. **Brand:** Robinhood usage is reviewed and compliant at the code/copy level. `Prediction Layer` is still a placeholder. A final name needs owner direction plus trademark counsel clearance; do not claim a trademark is clear from web searching.

## Required user inputs

Ask for these together, once:

1. Confirm whether Safe `0x5A205…6a39` is the governance Safe and whether its three owners completed the signer ceremony.
2. Production RPC HTTP and WebSocket secret locations (do not ask the user to paste secrets into source files).
3. Fee-recipient address.
4. Monitoring/paging webhook secret location and chosen log/metrics vendor.
5. Counsel-approved Terms, Privacy Notice, Risk Disclosure, jurisdiction/eligibility policy, and named approval evidence.
6. External audit report/remediation sign-off.
7. Final-name direction or permission to produce a distinctiveness-tested shortlist.

## Exact next actions

1. Verify `git status` and re-run current health checks.
2. Continue frontend/UI work that does not depend on legal text: audit the home, markets, market detail, funding modal, portfolio, communities and mobile layouts against `05_UI_UX_SPEC.md` and `C:\Users\aeyon\.codex\design.md`; preserve the existing design language; use CSS for simple motion and respect `prefers-reduced-motion`.
3. Keep legal screens visibly marked draft until counsel text arrives. When it arrives, implement versioned acceptance and server-side eligibility enforcement with tests; do not merely replace copy.
4. When monitoring destinations arrive, configure the secret, run `pnpm monitor:once`, execute the mixed-route staging load test, and write real staging measurements into `docs/monitoring-evidence.md`.
5. When brand direction is authorized, research collisions using official trademark registries and current domains/socials, present a ranked shortlist, obtain owner selection, then update centralized branding and all public docs/UI. Do not use Robinhood marks as part of the product name.
6. Only after the independent audit, counsel approval, production endpoints, Safe confirmation, and explicit mainnet authorization: run the protected mainnet workflow, verify source/constructor arguments, record every address/transaction/block, rehearse the timelock, and allowlist the audited router through the Safe after the delay.

## Official sources used

- Robinhood network/RPC: `https://docs.robinhood.com/chain/connecting/`
- Robinhood token contracts: `https://docs.robinhood.com/chain/contracts/`
- Robinhood Data Streams verifier: `https://docs.robinhood.com/chain/data-streams/`
- Robinhood brand guidelines: `https://docs.robinhood.com/chain/brand-guidelines/`
- Robinhood Chain terms: `https://docs.robinhood.com/chain/terms-of-service/`
- Uniswap v4 deployments: `https://developers.uniswap.org/docs/protocols/v4/deployments`
- Uniswap SDK constants: `https://github.com/Uniswap/sdks/blob/main/sdks/universal-router-sdk/src/utils/constants.ts`
- Safe deployment guidance: `https://docs.safe.global/core-api/safe-installation-overview`

## User constraint

The user instructed Codex to stop at 3% remaining usage and leave a handover. The last successful check before this file showed 95% used (5% remaining). Do not consume a usage-reset credit unless the user explicitly authorizes it.

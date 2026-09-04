# 08 — Build Roadmap

## Phase 0 — Repository and design system

Deliverables:

- pnpm/Turborepo monorepo,
- web/api/worker/contracts packages,
- env validation,
- chain config,
- CI,
- base design system,
- database migrations,
- local Docker compose for Postgres/Redis if desired.

Exit criterion:

All apps build and CI is green.

## Phase 1 — Smart contract vertical slice

Build:

- MockUSDG,
- Mock tokens,
- Mock oracle,
- OracleRegistry,
- Chainlink resolver abstraction,
- BinaryPoolMarket,
- MarketFactory,
- FeeVault,
- deployment scripts,
- Foundry unit/fuzz/invariant tests.

Exit criterion:

Local script can create market → two wallets enter opposite sides → advance time → resolve → winner claims.

## Phase 2 — Market browsing and wallet

Build:

- homepage,
- market directory,
- market detail,
- wallet connection,
- chain switch,
- direct USDG entry,
- transaction receipts,
- portfolio.

Exit criterion:

A wallet can enter a local/testnet market using direct collateral and later claim.

## Phase 3 — Indexer/API

Build:

- event backfill/subscription worker,
- PostgreSQL projections,
- market APIs,
- snapshots,
- wallet positions,
- claim history,
- health/indexer-lag monitoring.

Exit criterion:

Refreshing the web app reconstructs all state from indexed confirmed events and direct chain verification.

## Phase 4 — Meme-token funding layer

Build:

- wallet asset discovery,
- token metadata safety,
- quote endpoint,
- Uniswap mainnet integration,
- mock testnet swap adapter,
- pay-with-token modal,
- swap → enter state machine,
- source funding-token metadata.

Exit criterion:

On a mainnet fork, a wallet holding a liquid non-USDG ERC-20 can route into USDG and enter a market without manually leaving the app.

## Phase 5 — Chainlink resolution hardening

Build:

- live Stock Token feed configuration,
- staleness checks,
- sequencer uptime check,
- Stock Token oracle pause handling,
- corporate-action warning feed in admin,
- resolution grace/cancel path.

Exit criterion:

A fork/test deployment resolves a market only when oracle health checks pass and safely cancels/refunds when configured timeout conditions are met.

## Phase 6 — Community layer

Build:

- community list/detail,
- source-token market split,
- normalized volume,
- top predictors by funding community,
- participant wording rules,
- wallet leaderboard/profile.

Exit criterion:

Confirmed funding-source data produces reproducible community analytics.

## Phase 7 — UX compression

Evaluate:

- ERC-4337 smart account,
- gas sponsorship,
- batched approve/swap/enter,
- Permit2,
- optional hardened PredictionEntryRouter.

Exit criterion:

User can complete the funding-to-position flow with fewer confirmations without weakening transaction transparency or contract safety.

## Phase 8 — Production hardening

- external audit,
- remediation,
- compliance implementation,
- multisig/timelock,
- rate limits,
- production RPC,
- observability,
- incident response,
- load testing,
- final brand review.

## Phase 9 — Mainnet beta

Launch with:

- small curated set of markets,
- conservative funding-token support,
- conservative market limits,
- strong monitoring,
- no arbitrary market creation.

Scale only after observing correct routing, resolution, and claim behavior.

## Phase 10 — Advanced market trading

Research/implement after v0 stability:

- transferable YES/NO positions,
- continuous AMM or CLOB,
- early exit,
- limit orders,
- market making,
- advanced probability analytics.

This is a separate protocol-mechanics milestone, not a cosmetic frontend upgrade.

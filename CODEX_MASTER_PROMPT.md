# CODEX MASTER BUILD PROMPT

You are building a production-structured, test-first Robinhood Chain application from scratch.

Read this entire prompt before editing files.

## 0. Hard scope boundary

This is a completely standalone project.

Do **not** reference, import, mention, brand, connect, or reuse concepts from ROOK or Strixis anywhere in code, documentation, UI copy, commit messages, environment names, or comments.

Working project name is `Prediction Layer` only as a placeholder. Keep branding easy to rename through one config file.

## 1. Product to build

Build a wallet-native binary prediction market on Robinhood Chain.

Users should be able to:

1. connect an EVM wallet,
2. browse objective financial prediction markets,
3. choose YES or NO,
4. choose a supported ERC-20 already in their wallet as the funding asset,
5. use assets such as meme tokens (examples: PONS, DELTA, AI, CASHCAT) without manually leaving the app to buy USDG,
6. have the app quote/swap the funding token into canonical USDG collateral,
7. enter the market onchain,
8. wait for oracle resolution,
9. claim winnings onchain,
10. see their portfolio/history,
11. see analytics grouped by the original source funding token/community.

Important: examples such as PONS or AI are examples only. Token identity must always be `(chainId, contractAddress)`, never just symbol.

## 2. Core mechanism for v0

Do **not** build a CLOB or custom continuous AMM yet.

Implement a binary pooled parimutuel market:

- normalized collateral = USDG,
- YES pool and NO pool,
- users can enter until lock time,
- no early exit in v0,
- resolve from approved oracle,
- winners share full pool pro rata,
- protocol fee, if enabled, is charged only on profit,
- cancellation refunds principal,
- if winning side has zero stake, cancel/refund,
- default testnet fee = 0.

In UI call the displayed split “YES pool share / NO pool share” or “capital split,” not a mathematically exact implied probability.

## 3. Network facts

Create centralized chain config.

Robinhood Chain mainnet:

```text
chainId = 4663
native gas = ETH
public RPC = https://rpc.mainnet.chain.robinhood.com
explorer = https://robinhoodchain.blockscout.com
USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168
WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73
```

Robinhood Chain testnet:

```text
chainId = 46630
public RPC = https://rpc.testnet.chain.robinhood.com
explorer = https://explorer.testnet.chain.robinhood.com
```

Do not invent a testnet USDG address. Deploy `MockUSDG` for testnet/local if no official address is configured.

Mainnet Uniswap integration:

- Robinhood Chain supports Uniswap on chain 4663.
- The current documented Universal Router 2.1.1 address is `0x8876789976decbfcbbbe364623c63652db8c0904`.
- Verify third-party addresses against current official docs before real deployment; keep them config-driven.

Robinhood Stock Tokens:

- standard ERC-20,
- use exact official contract addresses,
- Chainlink price feeds exist,
- oracle values can include Stock Token multiplier effects,
- use oracle decimals dynamically,
- check staleness,
- check L2 sequencer uptime,
- account for `oraclePaused()` around corporate actions when applicable.

## 4. Repository architecture

Create a pnpm + Turborepo monorepo:

```text
apps/web
apps/api
apps/worker
packages/contracts
packages/sdk
packages/database
packages/chain-config
packages/ui
packages/types
packages/config
docs
scripts
.github/workflows
```

Use current stable compatible versions and pin them.

### web

- Next.js
- React
- TypeScript strict
- Tailwind
- shadcn/ui or equivalent
- wagmi + viem
- TanStack Query
- Zod

### api

- Fastify
- TypeScript strict
- Zod validation
- PostgreSQL
- Drizzle
- Redis

### worker

- viem WebSocket + HTTP fallback
- block backfill
- event indexing
- reorg-aware cursor
- snapshot jobs

### contracts

- Foundry
- Solidity current stable 0.8.x
- OpenZeppelin
- unit + fuzz + invariant tests

## 5. Solidity contracts

Implement:

```text
MarketFactory.sol
BinaryPoolMarket.sol
OracleRegistry.sol
ChainlinkPriceResolver.sol
FeeVault.sol
mocks/MockUSDG.sol
mocks/MockERC20.sol
mocks/MockAggregatorV3.sol
mocks/MockSequencerFeed.sol
```

### BinaryPoolMarket required data

- collateral token
- resolver
- oracle asset key
- comparator
- strike
- strike decimals
- open time
- lock time
- resolution time
- grace period
- fee bps
- min entry
- optional max entry
- yesPool
- noPool
- per-user YES stake
- per-user NO stake
- status
- winning outcome
- resolved price
- claim/refund state

### Market lifecycle

```text
OPEN → LOCKED → RESOLVED
             ↘ CANCELLED
```

Entries must always check the timestamp, even if a `lock()` transaction has not yet been called.

### Payout math

If YES wins:

```text
winningPool = yesPool
losingPool = noPool
gross = userYesStake * (winningPool + losingPool) / winningPool
profit = gross - userYesStake
fee = profit * feeBps / 10000
net = gross - fee
```

Same for NO.

Use safe rounding that preserves solvency.

### Required invariants

- no double claim,
- no double refund,
- no entry after lock,
- no early resolution,
- no outcome change after resolution,
- no cancellation after resolution,
- admin cannot withdraw user principal,
- pause never blocks claims/refunds,
- fee <= hard cap,
- contract always remains solvent.

## 6. Oracle implementation

Start with Chainlink `AggregatorV3Interface` resolver.

Validate:

- answer > 0,
- `updatedAt > 0`,
- staleness <= configured heartbeat/policy,
- sequencer is up,
- sequencer grace period elapsed,
- Stock Token oracle pause state when configured.

Do not assume feed decimals = 8; read them.

Do not allow an admin to arbitrarily type the winning result.

Resolution should be permissionless when the deterministic resolver can verify the outcome.

Add an interface/placeholder for a later Chainlink Data Streams resolver. Do not fake Data Streams verification.

## 7. Market creation

MVP creation is admin-only.

Use structured templates, not free-form arbitrary outcome logic.

Implement at minimum:

- PRICE_ABOVE_AT_TIME
- PRICE_BELOW_AT_TIME

Generate question copy from structured data.

Store critical resolution terms onchain.

Offchain metadata can include description/category/tags but cannot override onchain resolution.

## 8. Wallet asset discovery

After wallet connects:

1. ensure correct chain,
2. fetch ERC-20 balances through a managed indexed provider when configured,
3. fallback to configured known-token direct reads,
4. normalize metadata,
5. filter spam/dust,
6. progressively test quote eligibility to USDG.

Asset support statuses:

```text
UNKNOWN
DISCOVERED
QUOTE_PENDING
SUPPORTED
NO_ROUTE
HIGH_IMPACT
UNSAFE_BEHAVIOR
BLOCKED
DUST
```

Do not quote hundreds of tokens simultaneously.

## 9. Funding-token trade flow

### Direct USDG

- approve if necessary,
- call `enter()`.

### Non-USDG v0

Use a two-transaction implementation first:

1. funding token → USDG swap,
2. USDG → market entry.

Present it as one guided modal, but do not hide the fact that there are separate confirmations.

Later we may batch with ERC-4337.

### Quote service

Implement server-side quote endpoint so API keys stay private.

Force:

- chain ID from environment,
- output token = canonical USDG,
- configured router/provider,
- capped slippage,
- max price-impact policy,
- expiration.

Never let client provide arbitrary destination/router and have backend return it as trusted.

Persist quote metadata for analytics only; blockchain state remains authoritative.

## 10. Uniswap integration

For mainnet/fork:

- integrate current Uniswap Trading API or verified official SDK path,
- request route for exact input token → USDG,
- validate returned transaction target against configured router/allowlist,
- show route, min output, slippage, estimated impact,
- simulate transaction where possible before wallet submission.

For local/testnet:

- use `MockSwapAdapter` or mock quote service with deterministic rates,
- do not pretend testnet has mainnet liquidity.

Add mainnet-fork integration tests for real routing.

## 11. Backend database

Use Drizzle migrations for these core tables:

- assets
- oracle_assets
- markets
- market_snapshots
- chain_events
- trades
- claims
- refunds
- wallet_profiles
- wallet_stats
- community_stats
- market_community_splits
- admin_audit_log

Use `(chainId,address)` for token identity.

Use `(chainId,txHash,logIndex)` for event identity.

## 12. Indexer

Build a real worker.

Requirements:

- backfill from configured deployment block,
- subscribe over WebSocket,
- HTTP reconciliation fallback,
- persistent block cursor,
- store block hashes,
- idempotency,
- recent-block reorg detection and rewind,
- projection rebuild.

Index:

- MarketCreated
- PositionEntered
- MarketResolved
- MarketCancelled
- Claimed
- Refunded
- fees

Frontend should never depend only on optimistic unconfirmed DB rows.

## 13. Source-token/community attribution

For v0 two-step swap + entry:

- track original funding token in the authenticated browser trade session,
- correlate swap receipt and immediately following market entry by wallet/session,
- store attribution confidence = `SESSION_CORRELATED`,
- do not present it as fully trustless onchain attribution.

Later, a hardened `PredictionEntryRouter` can emit verified source funding token metadata.

Community analytics by source funding token:

- normalized USDG volume,
- participating wallets,
- per-market YES/NO capital split,
- realized PnL,
- hit rate,
- top predictors.

Wording must say “positions funded with PONS” rather than “all PONS holders believe…”

## 14. Pages

Implement:

```text
/
/markets
/market/[slug]
/portfolio
/assets
/communities
/community/[chainId]/[tokenAddress]
/leaderboard
/profile/[address]
/admin
/admin/markets/new
/docs
/terms
/risks
```

## 15. Homepage

Sections:

- hero
- trending
- closing soon
- Stock Token markets
- connected wallet assets
- community pulse
- top predictors
- recently resolved

## 16. Market detail page

Must show:

- question,
- status,
- countdown,
- YES/NO pool share,
- volume,
- chart of pool-share snapshots,
- trade panel,
- exact resolution terms,
- oracle source/address,
- activity,
- community split.

Trade panel:

- YES/NO selector,
- pay-with token selector,
- source amount,
- wallet balance,
- quote summary,
- projected payout,
- transaction steps,
- errors/recovery.

## 17. Wallet assets UI

Use token-card layout suitable for meme assets.

Each card:

- logo,
- name,
- symbol,
- balance,
- estimated collateral value,
- route status,
- “Use for predictions” CTA.

Never trust a token because its symbol matches a popular meme.

## 18. Portfolio

Tabs:

- Active
- Claimable
- Resolved
- History

Every position should show:

- side,
- normalized stake,
- original funding token when known,
- market state,
- current pool share,
- claim/refund state.

## 19. Admin

Use wallet-signed admin session plus onchain role checks.

Admin market wizard must show:

- asset,
- feed,
- latest oracle status,
- comparator,
- strike,
- times,
- grace period,
- fee,
- exact generated question,
- exact onchain params,
- contract transaction preview.

Existing market critical terms are immutable after creation.

## 20. Auth

Use nonce + signed wallet message for optional profiles/admin.

- one-time nonce,
- expiration,
- domain binding,
- replay protection,
- secure cookie/session.

Trading itself should not require centralized account registration.

## 21. UI error states

Implement explicit handling for:

- wrong network,
- unsupported wallet,
- RPC failure,
- no balance,
- quote unavailable,
- no route,
- quote expired,
- high price impact,
- approval required,
- rejected signature,
- failed swap,
- insufficient gas,
- market locks while quote is open,
- failed market entry,
- oracle unavailable,
- already claimed.

Do not use generic “Something went wrong” for known states.

## 22. Testing

### Contracts

- unit tests
- fuzz tests
- invariant tests
- coverage
- static analysis

### Frontend

- unit tests for math/formatting/state
- Playwright E2E local flow

### API

- endpoint validation tests
- auth replay tests
- quote allowlist tests
- DB aggregation tests

### Worker

- duplicate event
- restart/backfill
- reorg rewind
- projection consistency

### Full vertical slice

Automate locally:

1. connect test wallet,
2. wallet owns MockPONS,
3. choose live mock market,
4. swap MockPONS → MockUSDG,
5. enter YES,
6. second wallet enters NO,
7. advance time,
8. set oracle,
9. resolve,
10. claim,
11. verify DB/portfolio/community stats.

### Mainnet fork

Add tests for:

- canonical USDG,
- configured Stock Token Chainlink feed,
- real Uniswap route to USDG,
- transaction simulation.

Never broadcast real mainnet transactions from test suite.

## 23. CI

GitHub Actions must run:

- install with frozen lockfile,
- lint,
- typecheck,
- frontend/API tests,
- Foundry tests,
- contract static analysis where feasible,
- build all packages.

No deployment on normal PRs.

Mainnet deploy requires explicit manually approved workflow/environment.

## 24. Security rules

- no private key in repo,
- no private key in browser env,
- no arbitrary admin principal withdrawal,
- no arbitrary swap-call target,
- SafeERC20,
- reentrancy protection,
- immutable/frozen market terms,
- capped fees,
- pause blocks new entries but not claims/refunds,
- address-based token identity,
- exact quote binding,
- no fake chain success states.

## 25. Compliance hooks

Implement optional policy interfaces/config but do not invent legal policy.

Production can later plug in:

- geolocation eligibility,
- wallet risk screening,
- terms acceptance,
- KYC where legally required.

Do not implement or document any bypass of legal/KYC/geofence controls.

## 26. Brand/copy rules

- use “Robinhood Chain” in full,
- do not call it “Hood Chain,”
- do not claim Robinhood endorsement,
- use “Stock Tokens” consistently in external copy,
- keep Robinhood-specific branding assets optional/configurable and follow current official guidelines.

## 27. Documentation Codex must create/update

Create:

```text
README.md
docs/architecture.md
docs/contracts.md
docs/api.md
docs/database.md
docs/oracles.md
docs/swap-flow.md
docs/security.md
docs/deployment.md
docs/runbook.md
```

README must include local setup from a clean clone.

## 28. Local developer experience

A fresh developer should be able to run:

```bash
pnpm install
pnpm dev:infra
pnpm contracts:local
pnpm db:migrate
pnpm seed
pnpm dev
```

or an equivalent clearly documented sequence.

Provide `.env.example` with placeholders only.

Seed script should create:

- MockUSDG,
- MockPONS,
- MockDELTA,
- at least three example markets,
- sample oracle values.

Demo data must be clearly local/test data and never masquerade as live mainnet data.

## 29. Delivery behavior

Work milestone by milestone.

After each milestone:

1. run tests,
2. fix failures,
3. summarize changed files,
4. state what is genuinely working,
5. state what is still mocked,
6. do not label mocked integrations “complete.”

Do not skip contract tests to focus on styling.

Do not replace failed live integrations with silent hardcoded data.

## 30. Final definition of done for v0

The product is v0-complete only when this flow works end-to-end:

**Connect wallet → discover non-USDG token → obtain executable quote → swap to USDG → enter onchain binary market → lock → oracle resolves → winning wallet claims → indexed portfolio updates → source-token community analytics updates.**

Everything else is secondary to making that path real, correct, and testable.

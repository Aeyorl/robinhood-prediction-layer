# 02 — Technical Architecture

## 1. Architecture goal

Build a non-custodial application where blockchain state is authoritative for balances, market deposits, resolution, and claims, while an offchain backend provides indexing, search, quoting orchestration, analytics, and UX acceleration.

## 2. Recommended monorepo

Use `pnpm` + Turborepo.

```text
prediction-layer/
├─ apps/
│  ├─ web/                 # Next.js frontend
│  ├─ api/                 # Fastify TypeScript API
│  └─ worker/              # chain indexer, snapshots, jobs
├─ packages/
│  ├─ contracts/           # Foundry Solidity project
│  ├─ sdk/                 # shared typed contract/API SDK
│  ├─ database/            # Drizzle schema + migrations
│  ├─ chain-config/        # chain IDs, addresses, ABIs, registries
│  ├─ ui/                  # shared React components
│  ├─ types/               # shared domain types
│  └─ config/              # tsconfig/eslint/prettier/env helpers
├─ docs/
├─ scripts/
├─ .github/workflows/
├─ turbo.json
├─ pnpm-workspace.yaml
└─ README.md
```

## 3. Suggested technology choices

### Frontend

- Next.js, current stable release.
- React, current stable compatible release.
- TypeScript with `strict: true`.
- Tailwind CSS.
- shadcn/ui or equivalent headless components.
- wagmi + viem for EVM wallet/contract interaction.
- WalletConnect/injected connectors as compatible with current stack.
- TanStack Query for server/client query state.
- Zod for runtime input validation.
- Lightweight chart library for market snapshots if needed.

### Backend

- Node.js current LTS.
- Fastify.
- Zod type-provider or equivalent typed validation.
- PostgreSQL.
- Drizzle ORM.
- Redis for quote caching, rate limiting, job coordination.
- BullMQ or equivalent for scheduled/async jobs.

### Blockchain

- Solidity with current stable `0.8.x` compiler supported by OpenZeppelin.
- Foundry for build/test/deployment scripts.
- OpenZeppelin contracts.
- viem for server-side chain reads/indexing.

### Infrastructure

- Managed production RPC; do not use the rate-limited public RPC for production traffic.
- Recommended provider can be Alchemy because Robinhood Chain documentation explicitly lists it and its Data API/gasless infrastructure.
- Vercel or equivalent for web.
- Container-capable host for API and worker.
- Managed PostgreSQL.
- Managed Redis.
- Sentry or equivalent error reporting.

Pin all package versions in lockfile. Do not use floating `latest` in production manifests.

## 4. Robinhood Chain configuration

### Mainnet

```text
chainId: 4663
nativeCurrency: ETH
publicRpc: https://rpc.mainnet.chain.robinhood.com
explorer: https://robinhoodchain.blockscout.com
USDG: 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168
WETH: 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73
```

### Testnet

```text
chainId: 46630
publicRpc: https://rpc.testnet.chain.robinhood.com
explorer: https://explorer.testnet.chain.robinhood.com
```

Do not invent a testnet USDG address if one is not officially documented. Deploy a `MockUSDG` for deterministic testnet/local testing.

## 5. Chain address policy

Every external contract address must be centralized in `packages/chain-config`.

Example shape:

```ts
type ChainContracts = {
  usdg: Address;
  weth: Address;
  uniswapUniversalRouter?: Address;
  permit2?: Address;
  chainlinkDataStreamsVerifier?: Address;
  sequencerUptimeFeed?: Address;
  protocol: {
    marketFactory: Address;
    oracleRegistry: Address;
    feeVault: Address;
  };
};
```

Rules:

- Never scatter addresses through components.
- Never trust symbol strings as canonical assets.
- Validate contract bytecode exists during deployment/config boot.
- Keep testnet/mainnet configs separate.
- Before a release, verify all third-party addresses against official documentation.

## 6. Frontend architecture

Main domains:

- `wallet`
- `assets`
- `markets`
- `trade`
- `positions`
- `claims`
- `communities`
- `leaderboard`
- `admin`
- `auth`

Recommended frontend state split:

- blockchain state: wagmi/TanStack Query,
- indexed backend data: TanStack Query,
- transaction modal state: local component/Zustand only if necessary,
- no duplicative global store for chain state.

## 7. Wallet connection and chain switching

On connection:

1. Read connected chain ID.
2. If not 4663/46630 depending environment, request switch.
3. If chain missing in wallet, request add-chain with official network data.
4. Load balances after chain is correct.
5. Do not render a “success” trade state until the receipt is confirmed.

Support standard EVM wallets. Robinhood Wallet should work through its standard EVM connectivity; avoid proprietary assumptions unless official SDK behavior requires them.

## 8. Wallet asset discovery

Preferred path:

1. Query managed indexed wallet-data provider for ERC-20 balances on Robinhood Chain.
2. Fallback to known-token registry plus direct `balanceOf` reads.
3. Normalize metadata.
4. Apply spam/dust filtering.
5. For user-selected assets, request a live swap quote to USDG.

Do not synchronously request a DEX quote for hundreds of token balances on initial page load. Use progressive eligibility:

- fetch balances,
- sort by estimated value/relevance,
- quote the top N,
- quote additional assets on token-selector open or search.

### Asset status model

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

## 9. Swap integration

### Mainnet routing

Uniswap is a primary public AMM on Robinhood Chain and supports chain ID 4663 through its APIs/protocol deployments.

Use the current Uniswap Trading API or a verified direct integration. Prefer the API initially because it can choose the best supported route and provide transaction calldata.

At time of this specification, Uniswap documents Universal Router 2.1.1 for chain 4663 as:

`0x8876789976decbfcbbbe364623c63652db8c0904`

Treat this as configuration, not an eternal constant.

### Quote request inputs

- chain ID,
- input token address,
- output token = canonical USDG,
- exact input amount,
- sender,
- slippage tolerance,
- routing preference = best price unless there is a clear reason otherwise.

### Quote response stored/displayed

- input amount,
- estimated USDG out,
- minimum USDG out,
- gas estimate,
- route/protocol,
- price impact if available/computable,
- expiry/deadline,
- quote ID if provider returns one.

### Risk thresholds

Configuration example:

```text
DEFAULT_SLIPPAGE_BPS=50
MAX_USER_SLIPPAGE_BPS=300
WARN_PRICE_IMPACT_BPS=300
BLOCK_PRICE_IMPACT_BPS=1000
MIN_NORMALIZED_ENTRY_USDG=1e6  # adapt to token decimals
```

These are example defaults, not immutable economic policy.

### Transaction models

#### v0 EOA-compatible two-step flow

1. Swap funding token → USDG.
2. Enter market with USDG.

The UI presents this as one guided action sequence, but transactions remain explicit.

Advantages:

- simpler security boundary,
- easiest to debug,
- no arbitrary-call router in protocol contract.

#### v1 account-abstraction batch

Robinhood Chain supports ERC-4337. Use a smart account/paymaster stack to batch:

- approval/Permit2,
- swap,
- market entry,

into one user operation where supported.

#### v1 protocol entry router

Only consider a custom `PredictionEntryRouter` after security review.

Requirements if implemented:

- allowlist exact swap router,
- output token fixed to USDG,
- output recipient fixed to protocol flow,
- enforce `minOut`, deadline, and market ID,
- do not permit arbitrary external calls,
- use SafeERC20,
- emit original input token and normalized collateral amount,
- reentrancy guard,
- emergency pause.

## 10. Testnet swap strategy

Do not assume mainnet meme-token liquidity exists on testnet.

For testnet:

- deploy `MockUSDG`,
- deploy a few `MockMemeToken` contracts,
- use `MockSwapAdapter` with deterministic conversion rates,
- test the UX and protocol lifecycle end-to-end.

For real routing integration tests:

- use a Robinhood Chain mainnet fork,
- interact with actual deployed USDG/Uniswap contracts,
- do not broadcast mainnet transactions from CI.

## 11. Market lifecycle architecture

```text
DRAFT (offchain/admin preview)
   ↓ create
OPEN
   ↓ lockTime reached
LOCKED
   ↓ oracle valid
RESOLVED_YES / RESOLVED_NO
   ↓ claims
FINAL

Alternative:
LOCKED → CANCELLED → refunds
```

Onchain should use a compact enum such as:

```text
OPEN
LOCKED
RESOLVED
CANCELLED
```

and store `winningOutcome` separately.

## 12. Oracle architecture

### 12.1 Stock Token price feeds

Robinhood Chain documents Chainlink price feeds for Stock Tokens. The standard interface is `AggregatorV3Interface`.

Important points:

- use feed-provided decimals,
- reject zero/negative values,
- validate `updatedAt`,
- check heartbeat/staleness,
- check L2 sequencer uptime,
- for Stock Tokens, account for the fact that feed value includes the token multiplier,
- check `oraclePaused()` on affected Stock Tokens as an additional safety signal,
- be aware feeds update 24/5 rather than continuously across weekends.

### 12.2 Market wording

If the oracle returns Stock Token value, phrase the market as a Stock Token market.

Good:

“Will NVDA Stock Token be at or above $200…?”

Avoid implying the oracle is necessarily the raw underlying NASDAQ share price.

### 12.3 Resolution timing

A simple `latestRoundData()` resolver is acceptable for a controlled MVP if it enforces a narrow freshness window and the operator resolves promptly.

For stronger production-grade exact-time resolution, use Chainlink Data Streams signed reports and verify them onchain. Robinhood Chain currently documents a mainnet Data Streams verifier proxy.

### 12.4 OracleRegistry

Store per supported outcome asset:

```text
assetId
stockTokenAddress (if applicable)
feedProxy
feedDecimals
heartbeatSeconds
sequencerFeed
resolverType
active
```

At market creation, snapshot the oracle parameters used by the market so later registry changes cannot silently alter existing market terms.

### 12.5 Corporate actions

Stock Token oracle values can change based on the multiplier and feeds may pause during corporate-action processing.

Market engine should:

- query known pending corporate actions offchain when creating markets,
- avoid scheduling vulnerable short-term markets through known pause windows where possible,
- cancel or delay resolution if the oracle is paused/stale beyond allowed policy,
- clearly define fallback/cancellation timeout.

## 13. Backend API responsibilities

The API must not custody user funds or sign user trades.

Responsibilities:

- market discovery/search,
- wallet asset metadata aggregation,
- swap quote proxy/orchestration if API keys must remain server-side,
- market snapshots,
- community analytics,
- predictor stats,
- signed-message sessions,
- admin metadata/forms,
- health/config endpoints.

Blockchain writes happen from the user wallet except explicitly authorized protocol-admin transactions.

## 14. Indexer/worker

The worker listens to protocol contract events and writes an idempotent projection to PostgreSQL.

Required behavior:

- keep per-chain block cursor,
- backfill on startup,
- subscribe via WebSocket for low latency,
- reconcile missed blocks,
- identify events by `(chainId, txHash, logIndex)`,
- handle reorgs conservatively,
- never treat unconfirmed pending transactions as final database truth.

Events to index:

- MarketCreated
- MarketLocked
- PositionEntered
- MarketResolved
- MarketCancelled
- Claimed
- Refunded
- FeeCollected
- source-token entry event when router exists

## 15. Snapshot worker

Periodic snapshots for charts/community views:

- yes pool,
- no pool,
- capital ratio,
- cumulative normalized volume,
- participant count,
- source-token breakdown.

A one-minute interval is sufficient for initial UX; do not over-engineer high-frequency snapshots before there is volume.

## 16. Authentication

Public reads require no login.

For offchain user preferences/admin:

1. API issues nonce.
2. Wallet signs SIWE-compatible or equivalent EIP-191 message.
3. API verifies address + nonce + chain/domain + expiry.
4. Issue short-lived secure session/JWT cookie.
5. Rotate/expire nonce after use.

Never ask for private keys or seed phrases.

## 17. Admin security

Do not authorize admin actions using only an email/password dashboard.

Preferred:

- admin wallet allowlist,
- signed session,
- onchain role verification,
- multisig for mainnet ownership,
- timelock for sensitive config changes where practical.

## 18. Observability

Track:

- RPC error rate,
- quote error rate,
- quote-to-swap success,
- swap-to-market-entry success,
- indexer lag,
- oracle staleness,
- market resolution lag,
- failed claims,
- average price impact,
- unsupported-token reasons.

Every user-facing transaction failure should include a recoverable state and explorer link when a transaction was broadcast.

## 19. Environment variables

Example:

```text
NODE_ENV=
APP_ENV=local|testnet|mainnet
DATABASE_URL=
REDIS_URL=
ALCHEMY_API_KEY=
RH_MAINNET_RPC_URL=
RH_TESTNET_RPC_URL=
UNISWAP_API_KEY=
CHAINLINK_STREAMS_API_KEY=
CHAINLINK_STREAMS_API_SECRET=
SESSION_SECRET=
SENTRY_DSN=
ADMIN_WALLETS=
DEPLOYER_PRIVATE_KEY=        # deployment environment only, never web runtime
NEXT_PUBLIC_APP_ENV=
NEXT_PUBLIC_CHAIN_ID=
NEXT_PUBLIC_MARKET_FACTORY=
```

Secrets must never be committed and must never be exposed through `NEXT_PUBLIC_*` variables.

## 20. Production deployment principle

The repo must have three separate configurations:

- local/anvil,
- Robinhood Chain testnet,
- Robinhood Chain mainnet.

Mainnet deployment should require an explicit environment flag and manual approval in CI/CD. There must be no command that silently defaults to mainnet.

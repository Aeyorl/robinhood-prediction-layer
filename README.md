# Wagerly

Wallet-native binary prediction markets on **Robinhood Chain**. Users connect an EVM wallet, pick a YES/NO market on an objective financial outcome, fund their position with ERC-20 tokens they already hold (including meme tokens like PONS, DELTA, AI, CASHCAT), and the app swaps the funding token into canonical USDG collateral under the hood before entering the market onchain.

This project is **standalone** — it does not reference, depend on, or reuse branding from ROOK or Strixis.

> **Product name:** `Wagerly`. Branding is centralized in `packages/config/src/index.ts` so it can be renamed in one place.

## Status

| Phase | Scope                                                 | Status                                                                       |
| ----- | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| 0     | Repository + design system + CI                       | ✅ Buildable monorepo, CI green                                              |
| 1     | Smart contract vertical slice                         | ✅ Contracts + Foundry unit/fuzz/invariant tests                             |
| 2     | Market browsing + wallet (direct USDG entry)          | Local browser entry/resolve/claim flow verified                              |
| 3     | Indexer / API projections                             | Implemented in `bad1677`; event projections and market API                   |
| 4     | Meme-token funding layer                              | ✅ Local recovery/attribution and real Uniswap fork route-to-market verified |
| 5     | Chainlink resolution hardening                        | ✅ Health gating, Stock Token pauses, timeout refunds, admin warnings        |
| 6–10  | Community layer, UX compression, production hardening | 🚧 Planned                                                                   |

See `08_ROADMAP.md` and `docs/` for details.

For Phase 4 setup, required API environment variables, isolated PostgreSQL tests and browser recovery checks, see [the runbook](docs/runbook.md#phase-4-local-funding-setup-and-verification). Real Uniswap routing requires credentials, a verified supported proxy deployment and [fork validation](docs/swap-flow.md#real-routing-gate-passed-september-5-2026); the mock adapter is strictly local/testnet.

## Repository layout

```text
apps/web            Next.js frontend (React 19, Tailwind, wagmi + viem, TanStack Query, Zod)
apps/api            Fastify API (Zod validation, Drizzle, PostgreSQL, Redis)
apps/worker         Chain indexer (viem WS + HTTP fallback, reorg-aware cursor)
packages/contracts  Foundry smart contracts + tests
packages/sdk        Client SDK (payout math, ABIs, helpers)
packages/database   Drizzle schema + migrations
packages/chain-config  Robinhood Chain configuration (chain IDs, RPCs, addresses)
packages/ui         Minimal design-system primitives
packages/types      Shared types + Zod schemas
packages/config     Env validation + branding config
docs                Architecture, contracts, API, database, oracles, swap-flow, security, deployment, runbook
scripts             Local development helpers
```

## Requirements

- Node.js 22.12+ or 24 LTS (Node 24 recommended; Vitest 5 requires the newer runtime)
- pnpm ≥ 9 (install via `npm i -g pnpm`)
- Foundry (`foundryup`) for smart contracts
- Docker (optional) for local Postgres/Redis — everything else works without it

## Local setup from a clean clone

```bash
# 1. Install dependencies (frozen lockfile)
pnpm install

# 2. Start a local anvil chain (Robinhood Chain testnet id 46630)
pnpm dev:chain              # anvil --chain-id 46630 --port 8545

# 3. Deploy the contract vertical slice (mocks + example markets) onto it.
#    Writes packages/contracts/deployments/local.json.
pnpm contracts:local

# 4. Optional: local Postgres + Redis for the API/worker
pnpm dev:infra              # docker compose up -d postgres redis
pnpm db:generate && pnpm db:migrate && pnpm seed

# 5. Start all apps in dev mode
pnpm dev
```

> Phase 2 reads markets **directly from the local chain** (no database needed) —
> see “Local demo flow (Phase 2)” below for the exact env setup.

### Local demo flow (Phase 2) — web ↔ anvil

```bash
# Terminal 1: chain + contracts
pnpm dev:chain
pnpm contracts:local

# Terminal 2: web app against the local chain
cp apps/web/.env.example apps/web/.env.local
# edit apps/web/.env.local → NEXT_PUBLIC_CHAIN_ID=46630, NEXT_PUBLIC_LOCAL_CHAIN=true
pnpm --filter @pl/web dev
```

Open http://localhost:3000 — `/`, `/markets`, `/market/pons-above-100` and
`/portfolio` render live onchain market state (pools, status, terms). When the
local chain is not running, pages show an explicit “local chain offline” state
instead of fabricating data.

To drive a full lifecycle (two wallets enter opposite sides → lock → resolve →
claim) with `cast`, see `docs/runbook.md` → “Phase 2 vertical slice (local)”.

### Browser E2E (Playwright) — approve → enter → resolve → claim

A full vertical slice runs in a real Chromium browser against a fresh local
chain: connect the injected test wallet → faucet demo USDG → approve → enter
YES → an opposing wallet enters NO → lock → oracle resolves → the winning
wallet claims in the UI → the portfolio reflects the claimed position.

```bash
pnpm exec playwright install chromium   # one-time browser download
pnpm test:e2e                           # boots anvil + deploys + starts web on :3100
```

The suite owns ports 8545/3100 and tears everything down afterwards. It needs:

- `@playwright/test` + `esbuild` (root devDependencies, already installed)
- `forge` on PATH (contracts deploy via `forge script --unlocked` against anvil)
- No Docker/Postgres needed — markets are read directly from the chain.

Two known Windows quirks are handled inside the tooling: the forge broadcast
poller can outlive a successful deploy (the env script verifies contract code
onchain instead of trusting forge's exit code), and Node cannot resolve
MSYS-style paths from bash (the manifest path is converted with `cygpath -m`).

Alternative entry points:

```bash
pnpm --filter @pl/contracts test    # Foundry unit/fuzz/invariant tests
pnpm --filter @pl/web dev           # web only
pnpm --filter @pl/api dev           # API only
pnpm --filter @pl/worker dev        # indexer only
pnpm typecheck:e2e                  # typecheck the e2e suite only
```

Copy the relevant `.env.example` files before starting an app:

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
```

## Network facts (verify against official docs before any mainnet deployment)

- Robinhood Chain mainnet: chain ID `4663`, native gas ETH, RPC `https://rpc.mainnet.chain.robinhood.com`, explorer `https://robinhoodchain.blockscout.com`
- Robinhood Chain testnet: chain ID `46630`, RPC `https://rpc.testnet.chain.robinhood.com`, explorer `https://explorer.testnet.chain.robinhood.com`
- USDG (mainnet): `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`
- WETH (mainnet): `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`
- Uniswap Universal Router 2.1.1 (chain 4663): `0x8876789976decbfcbbbe364623c63652db8c0904`

All addresses live in `packages/chain-config` and are config-driven; they must be re-verified against official documentation at deployment time.

## Documentation index

Specification documents (at repo root):

- `01_PRODUCT_SPEC.md`, `02_TECHNICAL_ARCHITECTURE.md`, `03_SMART_CONTRACT_SPEC.md`, `04_API_DATABASE_SPEC.md`, `05_UI_UX_SPEC.md`, `06_SECURITY_COMPLIANCE.md`, `07_TESTING_AND_ACCEPTANCE.md`, `08_ROADMAP.md`, `CODEX_MASTER_PROMPT.md`

Operational docs (in `docs/`):

- `docs/architecture.md`, `docs/contracts.md`, `docs/api.md`, `docs/database.md`, `docs/oracles.md`, `docs/swap-flow.md`, `docs/security.md`, `docs/deployment.md`, `docs/runbook.md`

## Branding rules

- Use “Robinhood Chain” in full; never “Hood Chain”.
- Do not claim Robinhood endorsement.
- Use “Stock Tokens” consistently in external copy.
- Robinhood-specific branding assets are optional/configurable and must follow current official guidelines (`packages/config/src/branding.ts`).

## Security

- No private keys in the repository or browser environment.
- No arbitrary admin withdrawals of user principal.
- Market terms are immutable after creation.
- See `docs/security.md` for the full threat model.

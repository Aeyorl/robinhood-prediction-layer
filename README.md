# Prediction Layer

Wallet-native binary prediction markets on **Robinhood Chain**. Users connect an EVM wallet, pick a YES/NO market on an objective financial outcome, fund their position with ERC-20 tokens they already hold (including meme tokens like PONS, DELTA, AI, CASHCAT), and the app swaps the funding token into canonical USDG collateral under the hood before entering the market onchain.

This project is **standalone** — it does not reference, depend on, or reuse branding from ROOK or Strixis.

> **Working name:** `Prediction Layer` (placeholder). Branding is centralized in `packages/config/src/branding.ts` so it can be renamed in one place.

## Status

| Phase | Scope                                                                       | Status                                           |
| ----- | --------------------------------------------------------------------------- | ------------------------------------------------ |
| 0     | Repository + design system + CI                                             | ✅ Buildable monorepo, CI green                  |
| 1     | Smart contract vertical slice                                               | ✅ Contracts + Foundry unit/fuzz/invariant tests |
| 2     | Market browsing + wallet                                                    | 🚧 In progress                                   |
| 3     | Indexer / API projections                                                   | 🚧 Planned                                       |
| 4     | Meme-token funding layer                                                    | 🚧 Planned                                       |
| 5–10  | Resolution hardening, community layer, UX compression, production hardening | 🚧 Planned                                       |

See `08_ROADMAP.md` and `docs/` for details.

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

- Node.js ≥ 20.9 (Node 24 recommended)
- pnpm ≥ 9 (install via `npm i -g pnpm`)
- Foundry (`foundryup`) for smart contracts
- Docker (optional) for local Postgres/Redis — everything else works without it

## Local setup from a clean clone

```bash
# 1. Install dependencies (frozen lockfile)
pnpm install

# 2. Start local infrastructure (Postgres + Redis). Optional — skip if you
#    don't need the API/worker yet; contracts and web work without it.
pnpm dev:infra

# 3. Run a local chain and deploy the contract vertical slice (mocks + markets)
pnpm contracts:local        # starts anvil, deploys MockUSDG/MockPONS/..., creates example markets

# 4. Generate + apply database migrations
pnpm db:generate
pnpm db:migrate

# 5. Seed local demo data (markets, oracle values, sample positions)
pnpm seed

# 6. Start all apps in dev mode
pnpm dev
```

Alternative entry points:

```bash
pnpm --filter @pl/contracts test    # Foundry unit/fuzz/invariant tests
pnpm --filter @pl/web dev           # web only
pnpm --filter @pl/api dev           # API only
pnpm --filter @pl/worker dev        # indexer only
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

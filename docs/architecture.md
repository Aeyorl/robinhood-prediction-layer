# Architecture

## System overview

Wagerly is a wallet-native binary prediction market on Robinhood Chain. Users connect an EVM wallet, choose YES/NO on objective price markets, fund with supported ERC-20s they already hold, and the app swaps the funding token into canonical USDG collateral before entering the market onchain.

```text
┌────────────┐     ┌────────────┐     ┌────────────┐     ┌───────────────┐
│   web      │ ──▶ │   api      │ ──▶ │ postgres   │ ◀─┐ │   worker      │
│ (Next.js)  │     │ (Fastify)  │     │ + redis    │   │ │ (indexer)     │
└─────┬──────┘     └─────┬──────┘     └────────────┘   │ └───────┬───────┘
      │ read/quote       │ REST (zod)                   │         │ viem (ws/http)
      ▼                  ▼                              │         ▼
┌──────────────────────────────────────┐                │  ┌─────────────┐
│ wagmi + viem (wallet)                │                │  │ robinhood   │
│ @pl/sdk payout math + ABIs           │                │  │ chain RPC   │
└──────────────────────────────────────┘                │  └─────────────┘
                                                         ▼
                                              ┌─────────────────────┐
                                              │ contracts (foundry) │
                                              └─────────────────────┘
```

The blockchain is the authoritative state layer. The API/Postgres is a read-optimized projection built by the worker; the frontend never depends on optimistic unconfirmed DB rows.

## Repo layout (pnpm + Turborepo)

| Path                    | Role                                                                           |
| ----------------------- | ------------------------------------------------------------------------------ |
| `apps/web`              | Next.js (App Router), React 19, Tailwind v4, wagmi + viem, TanStack Query, Zod |
| `apps/api`              | Fastify, Zod validation, Drizzle/PostgreSQL, Redis                             |
| `apps/worker`           | viem WS + HTTP indexer, reorg-aware cursor, projections                        |
| `packages/contracts`    | Foundry: markets, factory, oracle stack, fee vault, mocks                      |
| `packages/sdk`          | Payout math (BigInt), typed ABIs (exported from Foundry), helpers              |
| `packages/database`     | Drizzle schema (13 tables), migrations, seed                                   |
| `packages/chain-config` | Chains, RPCs, canonical addresses (config-driven)                              |
| `packages/ui`           | Tailwind class-based design-system primitives                                  |
| `packages/types`        | Shared domain types + Zod schemas                                              |
| `packages/config`       | Env validation + branding (rename product in one place)                        |

## Market mechanism (v0)

Binary pooled parimutuel market with USDG as normalized collateral. No CLOB or continuous AMM.

- Users enter YES or NO until `lockTime` (checked against the timestamp directly).
- No early exit in v0.
- Resolution is permissionless via a deterministic resolver; admin cannot type a winner.
- Winners share the full pool pro rata. Protocol fee (default 0 on testnet) is charged only on profit.
- Cancellation refunds principal; an empty winning side cancels and refunds.
- Strict comparison: price == strike produces no winner → cancel/refund.

## Lifecycle

```text
OPEN → LOCKED → RESOLVED
             ↘ CANCELLED
```

## Identity rules

- Token identity is always `(chainId, contractAddress)` — never a symbol.
- Event identity is always `(chainId, txHash, logIndex)`.
- Oracle asset keys onchain are `keccak256(abi.encode(chainId, tokenAddress))`.

## Source-token / community attribution

The preferred funding flow uses the immutable `PredictionEntryRouter`: exact token approval followed by one atomic swap-and-enter transaction. The router emits source-token metadata and the worker records matching entries as `ONCHAIN`. The legacy separate swap/entry path remains a fallback when no router is configured and stays labelled `SESSION_CORRELATED`.

## Branding

`packages/config/src/branding.ts` is the single rename point. Robinhood Chain must be spelled in full; never claim Robinhood endorsement.

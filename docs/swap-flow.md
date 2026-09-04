# Swap flow (funding tokens → USDG)

The product thesis: users enter prediction markets with tokens they already hold (PONS, DELTA, AI, CASHCAT, …) without manually buying USDG first.

## v0 flow (two transactions, one guided modal)

```text
connect wallet
  → ensure chain (4663 / 46630)
  → discover ERC-20 balances
  → status: UNKNOWN → DISCOVERED → QUOTE_PENDING → SUPPORTED / NO_ROUTE / HIGH_IMPACT / UNSAFE_BEHAVIOR / BLOCKED / DUST
  → server-side quote (funding token → canonical USDG)
  → tx 1: approve if needed
  → tx 2: swap funding token → USDG (routed, capped slippage + impact)
  → tx 3: enter market with USDG
```

The modal presents all confirmations explicitly — nothing is hidden behind "one click" abstractions, and the API key for quoting lives server-side.

## Quote service rules

- Chain ID comes from the environment, never the client.
- Output token is forced to canonical USDG.
- The router/provider target is the configured, allowlisted one; the client can never supply a destination/router that the backend then returns as trusted.
- Slippage is capped, price-impact policy is enforced, and quotes expire.
- Quote metadata is persisted for analytics only — blockchain state remains authoritative.

## Routes

- Mainnet / fork: Uniswap (Robinhood Chain supports Uniswap on chain 4663). Integrate the current Uniswap Trading API or verified official SDK path; validate the returned transaction target against the configured Universal Router allowlist; simulate where possible before wallet submission.
- Local / testnet: `MockSwapAdapter` or a deterministic mock quote service. We do not pretend testnet has mainnet liquidity.

## Attribution

The original funding token is tracked in the authenticated browser session and correlated with the immediately following market entry → `attribution = SESSION_CORRELATED` (not trustless onchain attribution). A hardened `PredictionEntryRouter` that emits verified source-token metadata is a later milestone.

## Later (Phase 7)

ERC-4337 smart accounts, gas sponsorship, batched approve/swap/enter, Permit2 — only after the unbatched path is stable and testable.

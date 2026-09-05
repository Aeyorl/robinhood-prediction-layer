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
  → tx 3: approve USDG for the market if needed
  → tx 4: enter market with the USDG actually received
```

The modal presents all confirmations explicitly — nothing is hidden behind "one click" abstractions, and the API key for quoting lives server-side.

The implemented modal persists the quote, side, swap hash and entry hash in tab session storage scoped to chain/wallet/market. Reload/retry checks existing receipts before submitting anything new. After a successful swap, entry rejection or market lock never triggers a second swap: USDG remains in the wallet. Wallet/network changes stop the flow. Failed attribution can be retried after a confirmed entry without submitting another entry. Signed attribution is an extra message signature, not a transaction.

## Quote service rules

- Chain ID comes from the environment, never the client.
- Output token is forced to canonical USDG.
- The router/provider target is the configured, allowlisted one; the client can never supply a destination/router that the backend then returns as trusted.
- Slippage is capped, price-impact policy is enforced, and quotes expire.
- Quote metadata is persisted for analytics only — blockchain state remains authoritative.

## Routes

- Mainnet / fork: the Uniswap Trading API adapter requests CLASSIC V2/V3 quotes with proxy approval, validates chain/amounts/recipient/slippage/price impact and pins the transaction destination to an explicit allowlist containing Uniswap's current deterministic proxy and immutable legacy proxy. Nonempty onchain bytecode is mandatory.
- Local / testnet: `MockSwapAdapter` or a deterministic mock quote service. We do not pretend testnet has mainnet liquidity.

## Attribution

The original funding token is tracked in the authenticated browser session and correlated with the immediately following market entry → `attribution = SESSION_CORRELATED` (not trustless onchain attribution). A hardened `PredictionEntryRouter` that emits verified source-token metadata is a later milestone.

## Real routing gate (passed September 5, 2026)

Official references checked September 5, 2026: [quote API](https://developers.uniswap.org/docs/api-reference/aggregator_quote), [proxy approval workflow](https://developers.uniswap.org/docs/trading/swapping-api/concepts/no-permit2-workflow), and [standard swap guide](https://developers.uniswap.org/docs/trading/swapping-api/start-building/integration-guide). Robinhood Chain supports the Trading API and UniswapX V3. The deterministic proxy, immutable legacy proxy, Permit2, Universal Router 2.1.1, Dutch V3 reactor and quoter all have nonempty bytecode on chain 4663. The live API currently returned the documented legacy proxy for the Robinhood CLASSIC path. The v0 UI intentionally keeps this approve-then-swap flow; UniswapX needs the separately designed Permit2 signature/order path.

Authenticated evidence: a live CLASSIC quote routed canonical WETH to canonical USDG through V3 pool `0x52e65B17fB6E5BA00Ed806f37Afcd2DaA50271Ca` at the 0.01% fee tier. The runner approved the exact WETH amount, simulated and executed the provider calldata on an isolated chain-4663 Anvil fork, verified the received USDG met the minimum, deployed the production `BinaryPoolMarket` bytecode with canonical USDG collateral, entered its YES side with the exact routed output, and verified the pool, wallet stake and collateral balance. It then reverted the snapshot. No mainnet transaction was broadcast.

Start Anvil with a recent chain-4663 mainnet block from an archive-capable RPC on a loopback port. Set `FUNDING_FORK_RPC_URL`, `FUNDING_FORK_WALLET` (a public token holder whose live balance Uniswap can simulate), and server-side `UNISWAP_API_KEY`, then run `pnpm --filter @pl/api test:fork`. Canonical WETH and 0.0001 WETH are the default token and amount; both can be overridden. The command builds the production market artifact first. The runner impersonates only on the fork, funds gas locally, approves the exact amount, fetches a live quote, simulates/executes it, checks actual USDG received, deploys a temporary market using canonical USDG, enters with the routed output, verifies the resulting position, and restores the snapshot. Missing credentials are a failure, not a passing mock test.

## Later (Phase 7)

ERC-4337 smart accounts, gas sponsorship, batched approve/swap/enter, Permit2 — only after the unbatched path is stable and testable.

# Runbook

## Daily operations

### Check health

```bash
curl -s localhost:3001/health   # { ok, db, redis }
```

If `ok: false`, the API is degraded (never fabricated as healthy). Web pages that need indexed data show empty states rather than fake data.

### Indexer lag

```bash
pnpm --filter @pl/worker dev
```

The worker logs every indexed block and its cursor. Lag = `head - cursor`. If the worker is down, restart it — the persistent cursor resumes and backfills gaps automatically. Reorgs at the head are detected by parent-hash comparison and trigger a rewind + re-backfill log.

The worker needs `FACTORY_ADDRESS` (the MarketFactory it watches for `MarketCreated` events). Locally that's the `factory` field of `packages/contracts/deployments/local.json` (written by `pnpm contracts:local`). On a fresh start it binary-searches the factory deployment block and backfills from there, so no `MarketCreated` is missed. It degrades gracefully without Postgres/Redis (logs heads only) and requires Postgres to write projections.

### Apply migrations

```bash
pnpm db:generate   # after schema changes
pnpm db:migrate    # apply
```

### Seed fresh local data

```bash
pnpm contracts:local   # anvil + vertical slice deployment
pnpm db:migrate
pnpm seed              # idempotent: skips existing markets
```

## Phase 2 vertical slice (local)

End-to-end flow against anvil: two wallets enter opposite sides → lock →
advance time → fresh oracle answer → resolve → winner claims. Verified with
the deployed local manifest (`packages/contracts/deployments/local.json`).

```bash
# Setup (two terminals)
pnpm dev:chain            # anvil --chain-id 46630 --port 8545
pnpm contracts:local     # forge script DeployLocal (mocks + 3 example markets)
```

```bash
RPC=http://127.0.0.1:8545
BOB=0x70997970c51812dc3a010c7d01b50e0d17dc79c8    # anvil account #1
CAROL=0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc  # anvil account #2
MKT=$(node -p "require('./packages/contracts/deployments/local.json').markets[0].address")
USDG=$(node -p "require('./packages/contracts/deployments/local.json').usdg")
FEED=$(node -p "require('./packages/contracts/deployments/local.json').markets[0].feed")

# 1. Fund + enter opposite sides (MockUSDG mint is public — local only)
cast send $USDG "mint(address,uint256)" $BOB   2000e18 --unlocked --from $BOB   --rpc-url $RPC
cast send $USDG "mint(address,uint256)" $CAROL 2000e18 --unlocked --from $CAROL --rpc-url $RPC
cast send $USDG "approve(address,uint256)" $MKT 1000e18 --unlocked --from $BOB   --rpc-url $RPC
cast send $MKT "enter(uint8,uint256)" 1 100e18 --unlocked --from $BOB   --rpc-url $RPC   # YES 100
cast send $USDG "approve(address,uint256)" $MKT 1000e18 --unlocked --from $CAROL --rpc-url $RPC
cast send $MKT "enter(uint8,uint256)" 2 50e18  --unlocked --from $CAROL --rpc-url $RPC   # NO 50

# 2. Lock at/after lockTime
LOCK=$(cast call $MKT "lockTime()(uint256)" --rpc-url $RPC | cut -d' ' -f1)
cast rpc anvil_setNextBlockTimestamp $((LOCK+2)) && cast rpc anvil_mine
cast send $MKT "lock()" --unlocked --from $BOB --rpc-url $RPC

# 3. Resolve at/after resolutionTime with a FRESH feed answer (> strike 100)
RES=$(cast call $MKT "resolutionTime()(uint256)" --rpc-url $RPC | cut -d' ' -f1)
cast rpc anvil_setNextBlockTimestamp $((RES+2)) && cast rpc anvil_mine
cast send $FEED "setAnswer(int256)" 150e18 --unlocked --from $BOB --rpc-url $RPC  # stamp updatedAt=now
cast send $MKT "resolve()" --unlocked --from $BOB --rpc-url $RPC

# 4. Winner claims; loser cannot
cast send $MKT "claim()" --unlocked --from $BOB --rpc-url $RPC      # BOB (YES) → 150e18 on 100e18
cast call $MKT "winningOutcome()(uint8)" --rpc-url $RPC             # 1 = YES
cast call $USDG "balanceOf(address)(uint256)" $BOB --rpc-url $RPC   # 2050e18
cast send $MKT "claim()" --unlocked --from $CAROL --rpc-url $RPC    # reverts NothingToClaim
```

Web UI: with `NEXT_PUBLIC_CHAIN_ID=46630` + `NEXT_PUBLIC_LOCAL_CHAIN=true`
(see README) the markets list, market detail (pools, terms, resolve/claim
buttons), and portfolio read the same live state. To click approve/enter from
the browser, import an anvil account into your wallet (chain 46630, RPC
`http://127.0.0.1:8545`) — entries need USDG, so use the panel’s “Get demo
USDG (local only)” faucet (public `MockUSDG.mint`).

Oracle rule reminder: the resolver rejects stale answers, so `setAnswer` must
happen _after_ the final time warp (it stamps `updatedAt = block.timestamp`).

## Browser E2E (Playwright)

The same vertical slice runs in a real Chromium browser against a fresh local
environment (anvil + deploy + web on :3100), with an injected EIP-1193 wallet
that signs with an anvil dev key. It covers: connect → faucet → approve →
enter YES → opposing wallet enters NO → lock → resolve → claim in the UI →
portfolio shows the claimed position.

```bash
pnpm exec playwright install chromium   # one-time browser download
pnpm test:e2e                           # boots + tears down its own env
pnpm typecheck:e2e                      # typecheck the suite standalone
```

Reuse an already-running local env instead of booting a fresh one:

```bash
E2E_REUSE=1 E2E_WEB_URL=http://127.0.0.1:3100 pnpm test:e2e
```

### Windows quirks handled in the tooling

- **forge poller hang**: `forge script --broadcast` can stay alive (or get
  killed by `timeout`) _after_ the onchain execution finished. The env script
  therefore judges success by `eth_getCode` at every manifest address and
  retries, never by forge's exit code.
- **MSYS paths vs Node**: `require('/c/Project folder/...')` fails under Node
  on Windows (and backslashes corrupt JS strings, e.g. `\r`). The manifest
  path is converted with `cygpath -m` before reading.
- **Next dev cross-origin block**: Next 16 blocks `/_next/hmr` websockets for
  non-localhost origins; `apps/web/next.config.ts` sets
  `allowedDevOrigins: ["127.0.0.1", "localhost"]`. Without it, hydration
  stalls and the Connect button stays disabled.
- **wagmi session persistence**: wagmi persists the connection in
  localStorage, so after a reload the header may auto-reconnect and never show
  the Connect button; `ensureConnected` waits for the address first.

## Known honest gaps (current milestones)

- Phase 4's real route-to-market gate passed on an isolated Robinhood Chain fork; see `swap-flow.md`. This is integration evidence, not a production-readiness claim.
- Phase 5 supports a Chainlink sequencer uptime feed, but no official Robinhood Chain feed address is currently published in Chainlink's reference directory. Production config remains empty until one is verified.
- Community analytics are Phase 6.

## Phase 5 oracle operations

Open `/admin` before creating or resolving a Stock Token market. The page reads the curated AAPL, NVDA, and TSLA Chainlink rounds, each token's live `oraclePaused()` value, multiplier metadata, and corporate-action records. Any stale/incomplete round, future timestamp, operator pause, Stock Token pause, or unreadable dependency is unhealthy.

Factory-created markets freeze the feed-related config hash at creation. If a feed configuration must change while a market is locked, resolution remains blocked for that market. Once its exact `resolutionTime + gracePeriod` deadline passes and health remains false, call `cancelAfterOracleTimeout()` from any wallet. Participants then call `refund()` themselves. Do not use timeout cancellation while health is true; the contract rejects it.

## Phase 3 indexer (implemented)

The worker decodes `MarketCreated` (factory) plus `PositionEntered`, `MarketLocked`,
`MarketResolved`, `MarketCancelled`, `Claimed`, `Refunded`, and `FeeCollected`
(binary market) into idempotent projections — `chain_events`, `markets`,
`trades`, `claims`, `refunds`, `market_snapshots`. Every block is one DB
transaction; a failed block leaves the cursor behind it and is retried. Reorg
rollback deletes projections for the rewound window and re-backfills. The API
(`/v1/markets`) reads these projections, so refreshing the web app reconstructs
state from indexed confirmed events.

Attribution defaults to `UNKNOWN`. Phase 4's signed correlation upgrades only verified swap/entry pairs to `SESSION_CORRELATED`.

## Phase 4 local funding setup and verification

1. Run the local chain and `pnpm contracts:local`. The deployment now includes a funded `MockSwapAdapter` and deterministic token rates. Old local manifests need redeployment before token swaps work.
2. Run `pnpm db:migrate` to apply the funding tables. Export API variables from `apps/api/.env.example`: copy `usdg`, `mockSwapAdapter`, `predictionEntryRouter` and mock token addresses from the generated manifest. Set `RPC_HTTP_URL` to the local chain. Set the web `NEXT_PUBLIC_API_URL` to this API instance.
3. Start the API with the exported environment, or `pnpm --filter @pl/api exec tsx --env-file=.env src/index.ts`. Start the worker with its existing factory/RPC/database variables. Token discovery begins at the worker's backfill boundary; older holdings require configured fallback addresses or a fuller backfill. Transfer observations identify candidates; displayed balances are live reads.
4. Open a market, connect a wallet holding a mock token, and choose **Pay with another token**. Get a quote, approve the exact funding-token amount, then confirm the atomic routed entry. The portfolio labels the funding source as verified onchain attribution.

The automated browser test verifies the two-confirmation routed entry, indexed onchain attribution, resolution and payout. It also retains desktop/mobile quote screenshots and a portfolio screenshot under `.e2e/`.

```powershell
# Isolated ports preserve the normal local dev chain/API.
$env:E2E_RPC_URL='http://127.0.0.1:18545'
$env:E2E_WEB_URL='http://127.0.0.1:13100'
$env:E2E_API_PORT='13001'
pnpm test:e2e
pnpm test
pnpm typecheck:tests
```

PostgreSQL must be reachable (`TEST_DATABASE_URL` overrides the default local development connection). Each test environment creates a unique schema, applies migrations and removes only its own schema. The E2E bootstrap restores the existing local deployment manifest after stopping its processes. Occupied test ports are refused rather than terminated. The browser suite uses installed Chrome and Anvil/Foundry/Git Bash on Windows.

Recovery: an expired quote before the swap can be refreshed; approvals already confirmed remain valid. After a swap, **Resume funding flow** checks the saved receipt and retries entry only. After an entry, it retries only attribution. If the market locks, USDG stays in the wallet. Missing/replaced transaction hashes require inspecting the wallet transaction history; do not clear saved progress and swap again blindly. Metadata read failures are marked `UNREADABLE`; investigate the token before resetting its metadata status to `PENDING`.

### Verified September 5, 2026

- 38 Vitest API/worker tests passed, including isolated PostgreSQL migrations, idempotent transfer replay, metadata failures, signed attribution timing, quote policy and orphaned-swap rejection.
- 69 Foundry tests passed, including the nine saved mock swap adapter tests and existing fuzz/invariant suites.
- Three Playwright tests passed on isolated Anvil: direct USDG entry/claim, mock PONS funding with rejection/reload recovery and attribution/claim, and the local-only demo guard. The funding quote was checked at 1280px and 390px widths.
- Workspace typechecks, test/E2E typechecks, lint, formatting and production build passed. Build still emits existing contract timestamp/typecast lint warnings and a dynamic manifest filesystem tracing warning.
- The authenticated fork runner routed canonical WETH through Uniswap to canonical USDG, verified minimum output, deployed the production `BinaryPoolMarket` bytecode with USDG collateral, entered the market with the exact routed output and verified the resulting pool and wallet stake. The isolated fork snapshot was reverted and no mainnet transaction was broadcast. This satisfies Phase 4's route-to-market integration criterion; it is not a production-readiness claim.

## Failure playbooks

| Symptom                                               | Action                                                                                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install` fails                                  | Slow registry: `.npmrc` fetch timeouts are set for this machine; retry (`pnpm install` resumes). Lockfile is the source of truth in CI (`--frozen-lockfile`). |
| `forge test` red                                      | Run `forge test -vvvv`; oracle-health tests depend on feed timestamps being stamped after the final `vm.warp` (fresh round) — see `test/Base.t.sol`.          |
| API starts but `/v1/markets` returns 503              | Postgres down — `pnpm dev:infra`, then `pnpm db:migrate`.                                                                                                     |
| Market resolves to CANCELLED unexpectedly             | Check for price == strike (strict equality cancels), or an empty winning side, or stale/sequencer/paused oracle states via `resolver.health(assetKey)`.       |
| Worker cursor stuck                                   | Redis key `pl:worker:cursor`; delete it to backfill from the default start.                                                                                   |
| Wrong chain shown                                     | `CHAIN_ID` / `NEXT_PUBLIC_CHAIN_ID` mismatch across apps — both must be 4663 or 46630.                                                                        |
| Web shows “Local chain offline”                       | Manifest or chain missing. Run `pnpm dev:chain` + `pnpm contracts:local`, or point `PL_LOCAL_MANIFEST` at an existing `deployments/local.json`.               |
| Page errors `ChainDoesNotSupportContract: multicall3` | Client/server reads no longer use multicall3 (anvil doesn't deploy it); if this reappears, check no new code path calls `client.multicall`.                   |

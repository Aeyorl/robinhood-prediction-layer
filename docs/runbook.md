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

- Quote/swap endpoints and wallet asset discovery are Phase 4; the web surfaces show empty states, never fabricated data.
- Community analytics are Phase 6.

## Phase 3 indexer (implemented)

The worker decodes `MarketCreated` (factory) plus `PositionEntered`, `MarketLocked`,
`MarketResolved`, `MarketCancelled`, `Claimed`, `Refunded`, and `FeeCollected`
(binary market) into idempotent projections — `chain_events`, `markets`,
`trades`, `claims`, `refunds`, `market_snapshots`. Every block is one DB
transaction; a failed block leaves the cursor behind it and is retried. Reorg
rollback deletes projections for the rewound window and re-backfills. The API
(`/v1/markets`) reads these projections, so refreshing the web app reconstructs
state from indexed confirmed events.

Attribution is written as `UNKNOWN` until Phase 4 wires the funding-token swap
receipt correlation.

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

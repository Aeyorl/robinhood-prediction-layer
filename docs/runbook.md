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

## Known honest gaps (current milestones)

- Contract event decoding/projections in the worker are Phase 3 (the loop is real; the handlers are not yet wired).
- Quote/swap endpoints and wallet asset discovery are Phase 4; the web surfaces show empty states, never fabricated data.
- Community analytics are Phase 6.

## Failure playbooks

| Symptom                                   | Action                                                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install` fails                      | Slow registry: `.npmrc` fetch timeouts are set for this machine; retry (`pnpm install` resumes). Lockfile is the source of truth in CI (`--frozen-lockfile`). |
| `forge test` red                          | Run `forge test -vvvv`; oracle-health tests depend on feed timestamps being stamped after the final `vm.warp` (fresh round) — see `test/Base.t.sol`.          |
| API starts but `/v1/markets` returns 503  | Postgres down — `pnpm dev:infra`, then `pnpm db:migrate`.                                                                                                     |
| Market resolves to CANCELLED unexpectedly | Check for price == strike (strict equality cancels), or an empty winning side, or stale/sequencer/paused oracle states via `resolver.health(assetKey)`.       |
| Worker cursor stuck                       | Redis key `pl:worker:cursor`; delete it to backfill from the default start.                                                                                   |
| Wrong chain shown                         | `CHAIN_ID` / `NEXT_PUBLIC_CHAIN_ID` mismatch across apps — both must be 4663 or 46630.                                                                        |

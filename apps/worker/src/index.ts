/**
 * Prediction Layer chain indexer (skeleton).
 *
 * Runs a real loop today:
 *   - connects over WebSocket RPC (falls back to HTTP polling),
 *   - tracks a persistent block cursor (Redis when available, else memory),
 *   - detects recent-block reorgs by comparing parent hashes,
 *   - logs every head it indexes.
 *
 * Contract event decoding + projection writes (MarketCreated, PositionEntered,
 * MarketResolved, MarketCancelled, Claimed, Refunded, fees) are wired in the
 * Phase 3 milestone — this file deliberately does not fake them.
 */
import { createPublicClient, http, webSocket, type Chain, type PublicClient } from "viem";

import { getChain } from "@pl/chain-config";
import type { Database } from "@pl/database";
import { createClient } from "@pl/database";
import Redis from "ioredis";

import { env } from "./config.js";

const CURSOR_KEY = "pl:worker:cursor";
const RECENT_HASHES_DEPTH = 16;

interface IndexerDeps {
  chain: Chain;
  client: PublicClient;
  redis: Redis | null;
  db: Database | null;
  sql: ReturnType<typeof createClient>["client"] | null;
}

function makeClient(): { client: PublicClient; transport: "ws" | "http" } {
  try {
    const client = createPublicClient({
      chain: getChain(env.CHAIN_ID),
      transport: webSocket(env.RPC_WS_URL, { retryCount: 3, retryDelay: 1_000 }),
      batch: { multicall: true },
    });
    return { client, transport: "ws" };
  } catch (err) {
    console.warn("[worker] websocket unavailable, using http:", err);
    return {
      client: createPublicClient({
        chain: getChain(env.CHAIN_ID),
        transport: http(env.RPC_HTTP_URL),
      }),
      transport: "http",
    };
  }
}

async function loadCursor(redis: Redis | null): Promise<bigint> {
  if (redis) {
    const raw = await redis.get(CURSOR_KEY).catch(() => null);
    if (raw) return BigInt(raw);
  }
  // Default to the configured deployment block or the latest head minus a
  // safety window so the first run backfills recent events.
  const fallback = env.START_BLOCK > 0 ? BigInt(env.START_BLOCK) : 0n;
  return fallback;
}

async function saveCursor(redis: Redis | null, blockNumber: bigint): Promise<void> {
  if (!redis) return;
  await redis.set(CURSOR_KEY, blockNumber.toString()).catch(() => undefined);
}

/** Recent block hash ring used to detect reorgs at the head. */
function makeHashRing() {
  const entries: Array<{ number: bigint; hash: `0x${string}` }> = [];
  return {
    push(number: bigint, hash: `0x${string}`) {
      entries.push({ number, hash });
      if (entries.length > RECENT_HASHES_DEPTH) entries.shift();
    },
    find(number: bigint) {
      return entries.find((e) => e.number === number)?.hash;
    },
  };
}

/**
 * Detects how many blocks we need to rewind when the chain behind the cursor
 * changed. Returns 0 when the parent hash matches (no reorg).
 */
async function detectReorg(
  client: PublicClient,
  headNumber: bigint,
  ring: ReturnType<typeof makeHashRing>,
): Promise<bigint> {
  for (let depth = 1n; depth <= 8n; depth++) {
    const number = headNumber - depth;
    if (number <= 0n) return 0n;
    const known = ring.find(number);
    if (!known) return 0n;
    const block = await client.getBlock({ blockNumber: number });
    if (block.hash !== known) {
      // The chain at `depth` diverged from what we saw.
      return depth;
    }
    if (block.hash === known) break; // this ancestor is confirmed — no reorg
  }
  return 0n;
}

async function indexBlock(deps: IndexerDeps, blockNumber: bigint): Promise<void> {
  const block = await deps.client.getBlock({ blockNumber });
  console.log(`[worker] indexed block ${blockNumber} (${block.hash})`);
  // Phase 3: decode our contract events from `block.logs` and write
  // projections (chain_events / trades / claims / refunds) idempotently.
}

async function run() {
  const chain = getChain(env.CHAIN_ID);
  const { client, transport } = makeClient();
  console.log(`[worker] starting on chain ${chain.id} via ${transport}`);

  let redis: Redis | null = null;
  try {
    redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    await redis.connect();
  } catch {
    redis = null;
    console.warn("[worker] redis unavailable — cursor kept in memory only");
  }

  let db: Database | null = null;
  let sql: ReturnType<typeof createClient>["client"] | null = null;
  try {
    ({ db, client: sql } = createClient(env.DATABASE_URL));
    await sql`select 1`;
  } catch {
    db = null;
    console.warn("[worker] postgres unavailable — projections skipped (Phase 3)");
  }

  const deps: IndexerDeps = { chain, client, redis, db, sql };
  const ring = makeHashRing();

  let cursor = await loadCursor(redis);
  const head = await client.getBlockNumber();
  if (cursor === 0n) cursor = head - 100n < 0n ? 0n : head - 100n;
  console.log(`[worker] cursor at ${cursor}, head ${head}`);

  // WebSocket head subscription (used when the WS transport connected).
  if (transport === "ws") {
    const unwatch = client.watchBlockNumber({
      emitOnBegin: false,
      onBlockNumber: (blockNumber) => void onHead(deps, blockNumber, ring, () => unwatch()),
      onError: (err) => console.error("[worker] ws error:", err.message),
    });
  }

  // HTTP reconciliation fallback: always polls and fills gaps so the WS path
  // and restarts never miss blocks.
  setInterval(() => {
    void (async () => {
      const currentHead = await client.getBlockNumber().catch(() => null);
      if (currentHead === null) return;
      await onHead(deps, currentHead, ring, () => undefined);
    })();
  }, env.HTTP_POLL_INTERVAL_MS).unref?.();

  async function onHead(
    deps_: IndexerDeps,
    headNumber: bigint,
    ring_: ReturnType<typeof makeHashRing>,
    _unwatch: () => void,
  ) {
    if (headNumber <= cursor) return;

    const rewind = await detectReorg(deps_.client, headNumber, ring_);
    if (rewind > 0n) {
      console.warn(`[worker] reorg detected at depth ${rewind} — rewinding cursor`);
      cursor = headNumber - rewind;
      await saveCursor(redis, cursor);
      // Phase 3: delete affected projections and re-backfill.
    }

    const from = cursor + 1n;
    for (let n = from; n <= headNumber; n++) {
      await indexBlock(deps_, n);
      cursor = n;
    }
    await saveCursor(redis, cursor);
    const latest = await deps_.client.getBlock({ blockNumber: headNumber });
    ring_.push(headNumber, latest.hash);
  }

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} — shutting down`);
    await redis?.quit().catch(() => undefined);
    await sql?.end().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void run().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});

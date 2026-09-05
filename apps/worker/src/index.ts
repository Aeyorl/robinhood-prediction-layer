/**
 * Prediction Layer chain indexer.
 *
 * Runs a real loop today:
 *   - connects over WebSocket RPC (falls back to HTTP polling),
 *   - tracks a persistent block cursor (Redis when available, else memory),
 *   - detects recent-block reorgs by comparing parent hashes,
 *   - indexes every block: discovers markets from the MarketFactory, decodes
 *     contract events, and writes idempotent projections (chain_events /
 *     markets / trades / claims / refunds / market_snapshots — see
 *     projections.ts). Without Postgres it degrades to logging heads only.
 */
import { createPublicClient, http, webSocket, type Address, type Chain, type PublicClient } from "viem";

import { getChain } from "@pl/chain-config";
import type { Database } from "@pl/database";
import { createClient } from "@pl/database";
import { eq } from "drizzle-orm";
import Redis from "ioredis";

import { env } from "./config.js";
import { markets } from "@pl/database";
import { marketFactoryAbi } from "@pl/sdk";
import { processBlock, rollbackProjections } from "./projections.js";

const CURSOR_KEY = "pl:worker:cursor";
const RECENT_HASHES_DEPTH = 16;

interface IndexerDeps {
  chain: Chain;
  client: PublicClient;
  redis: Redis | null;
  db: Database | null;
  sql: ReturnType<typeof createClient>["client"] | null;
  chainId: number;
  factoryAddress: Address;
  marketAddresses: Set<Address>;
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
  return BigInt(env.START_BLOCK);
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

/**
 * Binary-search the first block where `address` has code. Used to backfill
 * from the factory deployment block instead of an arbitrary window.
 */
async function findDeploymentBlock(client: PublicClient, address: Address): Promise<bigint> {
  const head = await client.getBlockNumber();
  let lo = 0n;
  let hi = head;
  if ((await client.getCode({ address, blockNumber: lo })) !== "0x") return lo;
  if ((await client.getCode({ address, blockNumber: hi })) === "0x") {
    throw new Error("contract not deployed on this chain");
  }
  while (lo + 1n < hi) {
    const mid = lo + (hi - lo) / 2n;
    const code = await client.getCode({ address, blockNumber: mid });
    if (code === "0x") lo = mid;
    else hi = mid;
  }
  return hi;
}

/**
 * Seed the market registry from the markets projection (survives restarts)
 * and the factory's own `markets` array (covers markets created before the
 * cursor window ever started).
 */
async function loadKnownMarkets(
  client: PublicClient,
  factoryAddress: Address,
  db: Database | null,
  chainId: number,
): Promise<Set<Address>> {
  const known = new Set<Address>();
  if (db) {
    const rows = await db
      .select({ address: markets.address })
      .from(markets)
      .where(eq(markets.chainId, chainId));
    for (const row of rows) known.add(row.address as Address);
  }
  try {
    const count = (await client.readContract({
      address: factoryAddress,
      abi: marketFactoryAbi,
      functionName: "marketCount",
    })) as bigint;
    for (let i = 0n; i < count; i++) {
      const market = (await client.readContract({
        address: factoryAddress,
        abi: marketFactoryAbi,
        functionName: "markets",
        args: [i],
      })) as Address;
      known.add(market.toLowerCase() as Address);
    }
    console.log(`[worker] market registry: ${count} markets onchain, ${known.size} total known`);
  } catch (err) {
    console.warn(
      "[worker] could not enumerate factory markets:",
      err instanceof Error ? err.message : err,
    );
  }
  return known;
}

async function indexBlock(deps: IndexerDeps, blockNumber: bigint): Promise<void> {
  const block = await deps.client.getBlock({ blockNumber });
  let createdMarkets = 0;
  let events = 0;
  if (deps.db) {
    const counts = await processBlock({ ...deps, db: deps.db }, {
      number: blockNumber,
      hash: block.hash,
      timestamp: block.timestamp,
    });
    createdMarkets = counts.createdMarkets;
    events = counts.events;
  }
  console.log(
    `[worker] indexed block ${blockNumber} (${block.hash}) — ${createdMarkets} markets created, ${events} events`,
  );
}

async function run() {
  const chain = getChain(env.CHAIN_ID);
  const factoryAddress = env.FACTORY_ADDRESS.toLowerCase() as Address;
  const { client, transport } = makeClient();
  console.log(`[worker] starting on chain ${chain.id} via ${transport}`);
  console.log(`[worker] factory ${factoryAddress}`);

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
  } catch (err) {
    db = null;
    console.warn(
      "[worker] postgres unavailable — projections skipped:",
      err instanceof Error ? err.message : err,
    );
  }

  const marketAddresses = await loadKnownMarkets(client, factoryAddress, db, chain.id);
  const deps: IndexerDeps = {
    chain,
    client,
    redis,
    db,
    sql,
    chainId: chain.id,
    factoryAddress,
    marketAddresses,
  };
  const ring = makeHashRing();

  let cursor = await loadCursor(redis);
  const head = await client.getBlockNumber();
  if (cursor === 0n) {
    // Fresh start: backfill from the factory deployment block so no
    // MarketCreated is missed, falling back to a short window when the RPC
    // cannot answer the binary search (e.g. factory not deployed yet).
    try {
      cursor = await findDeploymentBlock(client, factoryAddress);
      console.log(`[worker] factory deployed at block ${cursor} — backfilling from there`);
    } catch {
      cursor = head - 100n < 0n ? 0n : head - 100n;
      console.log(`[worker] could not locate deployment block — backfilling last 100`);
    }
  }
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
      const rewindBlock = headNumber - rewind;
      console.warn(
        `[worker] reorg detected at depth ${rewind} — rewinding to block ${rewindBlock}`,
      );
      cursor = rewindBlock - 1n;
      await saveCursor(redis, cursor);
      if (deps_.sql) {
        try {
          await rollbackProjections(deps_.sql, deps_.chain.id, rewindBlock);
          console.warn(`[worker] rolled back projections >= block ${rewindBlock}`);
        } catch (err) {
          console.error("[worker] projection rollback failed:", err);
          return; // keep the cursor; retry rollback on the next poll
        }
      }
    }

    const from = cursor + 1n;
    for (let n = from; n <= headNumber; n++) {
      try {
        await indexBlock(deps_, n);
        cursor = n;
        await saveCursor(redis, cursor);
      } catch (err) {
        // A blocked/failed projection must not advance the cursor — the next
        // poll retries from here.
        console.error(
          `[worker] block ${n} failed — cursor stays at ${cursor}:`,
          err instanceof Error ? err.message : err,
        );
        break;
      }
    }
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
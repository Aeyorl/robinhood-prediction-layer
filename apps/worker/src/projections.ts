/**
 * Phase 3 projections for the chain indexer.
 *
 * Decodes `MarketCreated` (factory) and `BinaryPoolMarket` events into
 * idempotent PostgreSQL projections:
 *
 *   chain_events      → every decoded event (identity: chain + tx + logIndex)
 *   markets           → upserted from MarketCreated; status/pools from lifecycle events
 *   trades            → PositionEntered (attribution UNKNOWN until Phase 4+)
 *   claims            → Claimed (gross = net + fee)
 *   refunds           → Refunded
 *   market_snapshots  → one row per PositionEntered (pool trajectory for charts)
 *
 * Idempotency: a `chain_events` insert that conflicts (already processed) is
 * a no-op, and projections are only written when the event is newly recorded.
 * The whole block is one transaction, so a failed projection rolls back the
 * block's raw events too; the cursor never advances past a failed block.
 */
import { and, eq } from "drizzle-orm";
import postgres from "postgres";
import {
  binaryPoolMarketAbi,
  marketFactoryAbi,
  oracleAssetKey as buildOracleAssetKey,
} from "@pl/sdk";
import {
  assets,
  chainEvents,
  claims,
  marketSnapshots,
  markets,
  oracleAssets,
  refunds,
  trades,
  type Database,
} from "@pl/database";
import { parseEventLogs, type Address, type Log, type PublicClient } from "viem";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Db = Pick<Database, "insert" | "select" | "update" | "delete" | "query">;

export interface ProjectionDeps {
  chainId: number;
  factoryAddress: Address;
  /** Every market address the indexer knows about (mutated as markets are created). */
  marketAddresses: Set<Address>;
}

export interface BlockRef {
  number: bigint;
  hash: `0x${string}`;
  /** Unix seconds. */
  timestamp: bigint;
}

interface MarketCreatedArgs {
  index: bigint;
  market: Address;
  params: {
    collateral: Address;
    resolver: Address;
    oracleAssetKey: `0x${string}`;
    comparator: number;
    strike: bigint;
    strikeDecimals: number;
    openTime: bigint;
    lockTime: bigint;
    resolutionTime: bigint;
    gracePeriod: bigint;
    feeBps: bigint;
    minEntry: bigint;
    maxEntry: bigint;
    question: string;
    metadataUri: string;
    feeVault: Address;
  };
}

interface PositionEnteredArgs {
  user: Address;
  side: number;
  amount: bigint;
  yesPool: bigint;
  noPool: bigint;
}

interface MarketResolvedArgs {
  winningOutcome: number;
  price: bigint;
}

interface ClaimedArgs {
  user: Address;
  stake: bigint;
  net: bigint;
  fee: bigint;
}

interface RefundedArgs {
  user: Address;
  principal: bigint;
}

// ---------------------------------------------------------------------------
// ABI enum values (IMarket.sol: Side { NONE, YES, NO }, Comparator { above, below })
// ---------------------------------------------------------------------------

const SIDE_BY_CODE: Record<number, "YES" | "NO" | null> = {
  0: null, // NONE
  1: "YES",
  2: "NO",
};

const COMPARATOR_BY_CODE: Record<number, "PRICE_ABOVE_AT_TIME" | "PRICE_BELOW_AT_TIME" | null> = {
  0: "PRICE_ABOVE_AT_TIME",
  1: "PRICE_BELOW_AT_TIME",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDate(unixSeconds: bigint): Date {
  return new Date(Number(unixSeconds) * 1000);
}

function toAddress(value: string): Address {
  return value.toLowerCase() as Address;
}

/** Deep-convert bigint → decimal string so payloads are JSON-safe for jsonb. */
function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, jsonSafe(v)]));
  }
  return value;
}

/**
 * Deterministic readable slug. Always suffixed with part of the market address
 * so two markets with identical questions (even on different chains) never
 * collide on the global unique index. Stable across re-indexes.
 */
export function slugify(question: string, address: Address): string {
  const base =
    question
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "market";
  return `${base}-${address.toLowerCase().slice(2, 8)}`;
}

/**
 * OracleRegistry stores `keccak256(abi.encode(chainId, tokenAddress))` as the
 * asset key, which cannot be reversed. Resolve it against the `oracle_assets`
 * projection (seeded locally from the deployment manifest). Falls back to the
 * raw key so the row is never fabricated — a missing config stays visible.
 */
const oracleAssetCache = new Map<`0x${string}`, string>();

async function resolveOracleAssetAddress(
  db: Db,
  chainId: number,
  key: `0x${string}`,
): Promise<string> {
  const cached = oracleAssetCache.get(key);
  if (cached) return cached;

  // The key is keccak256(abi.encode(chainId, tokenAddress)) and cannot be
  // reversed onchain, so resolve it by re-deriving the key over every known
  // token on this chain: `oracle_assets` (feed-configured) first, then
  // `assets` (registered identities — mocks seeded from the deploy manifest).
  const candidates = new Set<string>();
  const configured = await db
    .select({ address: oracleAssets.address })
    .from(oracleAssets)
    .where(eq(oracleAssets.chainId, chainId));
  for (const row of configured) candidates.add(row.address);

  const registered = await db
    .select({ address: assets.address })
    .from(assets)
    .where(eq(assets.chainId, chainId));
  for (const row of registered) candidates.add(row.address);

  for (const address of candidates) {
    if (buildOracleAssetKey(chainId, address as Address) === key) {
      oracleAssetCache.set(key, address);
      return address;
    }
  }

  // Only positive lookups are cached; fallback is retried on later events.
  console.warn(
    `[worker] no asset registered under key ${key} on chain ${chainId} — storing key as placeholder`,
  );
  return key;
}

// ---------------------------------------------------------------------------
// Raw event registry (the idempotency gate)
// ---------------------------------------------------------------------------

async function recordEvent(
  tx: Db,
  deps: ProjectionDeps,
  block: BlockRef,
  ev: { log: Log; eventType: string; marketAddress: Address; args: unknown },
): Promise<boolean> {
  const inserted = await tx
    .insert(chainEvents)
    .values({
      chainId: deps.chainId,
      txHash: ev.log.transactionHash ?? "",
      logIndex: Number(ev.log.logIndex ?? 0),
      blockNumber: Number(block.number),
      blockHash: block.hash,
      eventType: ev.eventType,
      marketAddress: ev.marketAddress,
      payload: jsonSafe(ev.args),
    })
    .onConflictDoNothing()
    .returning({ id: chainEvents.id });
  return inserted.length > 0;
}

// ---------------------------------------------------------------------------
// Projections
// ---------------------------------------------------------------------------

async function projectMarketCreated(
  tx: Db,
  deps: ProjectionDeps,
  block: BlockRef,
  ev: Log,
  args: MarketCreatedArgs,
): Promise<void> {
  const market = toAddress(args.market);
  if (!(await recordEvent(tx, deps, block, { log: ev, eventType: "MarketCreated", marketAddress: market, args }))) {
    return;
  }

  const comparator = COMPARATOR_BY_CODE[args.params.comparator] ?? "PRICE_ABOVE_AT_TIME";
  const oracleAssetAddress = await resolveOracleAssetAddress(
    tx,
    deps.chainId,
    args.params.oracleAssetKey,
  );

  await tx
    .insert(markets)
    .values({
      chainId: deps.chainId,
      address: market,
      slug: slugify(args.params.question, market),
      question: args.params.question,
      template: comparator,
      comparator,
      strike: args.params.strike.toString(),
      strikeDecimals: args.params.strikeDecimals,
      collateralChainId: deps.chainId,
      collateralAddress: toAddress(args.params.collateral),
      oracleAssetChainId: deps.chainId,
      oracleAssetAddress,
      resolver: toAddress(args.params.resolver),
      feeBps: Number(args.params.feeBps),
      openTime: toDate(args.params.openTime),
      lockTime: toDate(args.params.lockTime),
      resolutionTime: toDate(args.params.resolutionTime),
      gracePeriodSeconds: Number(args.params.gracePeriod),
      minEntry: args.params.minEntry.toString(),
      maxEntry: args.params.maxEntry === 0n ? null : args.params.maxEntry.toString(),
      status: "OPEN",
      yesPool: "0",
      noPool: "0",
      volumeUsdg: "0",
      metadataUri: args.params.metadataUri,
      createdAt: toDate(block.timestamp),
    })
    .onConflictDoUpdate({
      target: [markets.chainId, markets.address],
      // Terms are immutable onchain; refresh them but never clobber the
      // seeded slug, pool state, or lifecycle status.
      set: {
        question: args.params.question,
        template: comparator,
        comparator,
        strike: args.params.strike.toString(),
        strikeDecimals: args.params.strikeDecimals,
        collateralChainId: deps.chainId,
        collateralAddress: toAddress(args.params.collateral),
        oracleAssetChainId: deps.chainId,
        oracleAssetAddress,
        resolver: toAddress(args.params.resolver),
        feeBps: Number(args.params.feeBps),
        openTime: toDate(args.params.openTime),
        lockTime: toDate(args.params.lockTime),
        resolutionTime: toDate(args.params.resolutionTime),
        gracePeriodSeconds: Number(args.params.gracePeriod),
        minEntry: args.params.minEntry.toString(),
        maxEntry: args.params.maxEntry === 0n ? null : args.params.maxEntry.toString(),
        metadataUri: args.params.metadataUri,
      },
    });
}

async function projectPositionEntered(
  tx: Db,
  deps: ProjectionDeps,
  block: BlockRef,
  ev: Log,
  args: PositionEnteredArgs,
): Promise<void> {
  const market = toAddress(ev.address);
  if (!(await recordEvent(tx, deps, block, { log: ev, eventType: "PositionEntered", marketAddress: market, args }))) {
    return;
  }

  const side = SIDE_BY_CODE[args.side];
  if (!side) {
    console.warn(`[worker] PositionEntered with unknown side ${args.side} at ${market}`);
    return;
  }
  const timestamp = toDate(block.timestamp);

  await tx
    .insert(trades)
    .values({
      chainId: deps.chainId,
      txHash: ev.transactionHash ?? "",
      logIndex: Number(ev.logIndex ?? 0),
      marketChainId: deps.chainId,
      marketAddress: market,
      wallet: toAddress(args.user),
      side,
      amountUsdg: args.amount.toString(),
      fundingTokenChainId: null,
      fundingTokenAddress: null,
      fundingAmount: null,
      attribution: "UNKNOWN",
      timestamp,
    })
    .onConflictDoNothing();

  // The event carries absolute pool totals, so this is idempotent — replaying
  // the same event converges to the same pools.
  await tx
    .update(markets)
    .set({
      yesPool: args.yesPool.toString(),
      noPool: args.noPool.toString(),
      volumeUsdg: (args.yesPool + args.noPool).toString(),
    })
    .where(and(eq(markets.chainId, deps.chainId), eq(markets.address, market)));

  await tx.insert(marketSnapshots).values({
    marketChainId: deps.chainId,
    marketAddress: market,
    recordedAt: timestamp,
    yesPool: args.yesPool.toString(),
    noPool: args.noPool.toString(),
    volumeUsdg: (args.yesPool + args.noPool).toString(),
  });
}

async function projectMarketLocked(tx: Db, deps: ProjectionDeps, block: BlockRef, ev: Log): Promise<void> {
  const market = toAddress(ev.address);
  if (!(await recordEvent(tx, deps, block, { log: ev, eventType: "MarketLocked", marketAddress: market, args: {} }))) {
    return;
  }
  await tx
    .update(markets)
    .set({ status: "LOCKED" })
    .where(and(eq(markets.chainId, deps.chainId), eq(markets.address, market)));
}

async function projectMarketResolved(
  tx: Db,
  deps: ProjectionDeps,
  block: BlockRef,
  ev: Log,
  args: MarketResolvedArgs,
): Promise<void> {
  const market = toAddress(ev.address);
  if (!(await recordEvent(tx, deps, block, { log: ev, eventType: "MarketResolved", marketAddress: market, args }))) {
    return;
  }
  await tx
    .update(markets)
    .set({
      status: "RESOLVED",
      winningOutcome: SIDE_BY_CODE[args.winningOutcome] ?? null,
      resolvedPrice: args.price.toString(),
      resolvedAt: toDate(block.timestamp),
    })
    .where(and(eq(markets.chainId, deps.chainId), eq(markets.address, market)));
}

async function projectMarketCancelled(
  tx: Db,
  deps: ProjectionDeps,
  block: BlockRef,
  ev: Log,
): Promise<void> {
  const market = toAddress(ev.address);
  if (!(await recordEvent(tx, deps, block, { log: ev, eventType: "MarketCancelled", marketAddress: market, args: {} }))) {
    return;
  }
  await tx
    .update(markets)
    .set({ status: "CANCELLED", cancelledAt: toDate(block.timestamp) })
    .where(and(eq(markets.chainId, deps.chainId), eq(markets.address, market)));
}

async function projectClaimed(
  tx: Db,
  deps: ProjectionDeps,
  block: BlockRef,
  ev: Log,
  args: ClaimedArgs,
): Promise<void> {
  const market = toAddress(ev.address);
  if (!(await recordEvent(tx, deps, block, { log: ev, eventType: "Claimed", marketAddress: market, args }))) {
    return;
  }
  await tx
    .insert(claims)
    .values({
      chainId: deps.chainId,
      txHash: ev.transactionHash ?? "",
      logIndex: Number(ev.logIndex ?? 0),
      marketChainId: deps.chainId,
      marketAddress: market,
      wallet: toAddress(args.user),
      gross: (args.net + args.fee).toString(),
      fee: args.fee.toString(),
      net: args.net.toString(),
      timestamp: toDate(block.timestamp),
    })
    .onConflictDoNothing();
}

async function projectRefunded(
  tx: Db,
  deps: ProjectionDeps,
  block: BlockRef,
  ev: Log,
  args: RefundedArgs,
): Promise<void> {
  const market = toAddress(ev.address);
  if (!(await recordEvent(tx, deps, block, { log: ev, eventType: "Refunded", marketAddress: market, args }))) {
    return;
  }
  await tx
    .insert(refunds)
    .values({
      chainId: deps.chainId,
      txHash: ev.transactionHash ?? "",
      logIndex: Number(ev.logIndex ?? 0),
      marketChainId: deps.chainId,
      marketAddress: market,
      wallet: toAddress(args.user),
      principal: args.principal.toString(),
      timestamp: toDate(block.timestamp),
    })
    .onConflictDoNothing();
}

// ---------------------------------------------------------------------------
// Block pipeline
// ---------------------------------------------------------------------------

/**
 * Index one block:
 *   1. factory `MarketCreated` logs → register markets + upsert rows,
 *   2. market lifecycle logs → chain_events + projections.
 *
 * Runs as a single DB transaction; any failure rolls back the whole block and
 * the caller keeps the cursor behind it.
 */
export async function processBlock(
  deps: ProjectionDeps & { client: PublicClient; db: Database },
  block: BlockRef,
): Promise<{ createdMarkets: number; events: number }> {
  return deps.db.transaction(async (tx) => {
    const factoryLogs = await deps.client.getLogs({
      address: deps.factoryAddress,
      fromBlock: block.number,
      toBlock: block.number,
    });
    const createdEvents = parseEventLogs({
      abi: marketFactoryAbi,
      logs: factoryLogs,
      eventName: ["MarketCreated"],
    });

    for (const ev of createdEvents) {
      const args = ev.args as unknown as MarketCreatedArgs;
      deps.marketAddresses.add(toAddress(args.market));
      await projectMarketCreated(tx, deps, block, ev, args);
    }

    const addresses = [...deps.marketAddresses];
    const marketLogs =
      addresses.length > 0
        ? await deps.client.getLogs({
            address: addresses,
            fromBlock: block.number,
            toBlock: block.number,
          })
        : [];
    const marketEvents = parseEventLogs({ abi: binaryPoolMarketAbi, logs: marketLogs });

    for (const ev of marketEvents) {
      switch (ev.eventName) {
        case "PositionEntered":
          await projectPositionEntered(tx, deps, block, ev, ev.args as unknown as PositionEnteredArgs);
          break;
        case "MarketLocked":
          await projectMarketLocked(tx, deps, block, ev);
          break;
        case "MarketResolved":
          await projectMarketResolved(tx, deps, block, ev, ev.args as unknown as MarketResolvedArgs);
          break;
        case "MarketCancelled":
          await projectMarketCancelled(tx, deps, block, ev);
          break;
        case "Claimed":
          await projectClaimed(tx, deps, block, ev, ev.args as unknown as ClaimedArgs);
          break;
        case "Refunded":
          await projectRefunded(tx, deps, block, ev, ev.args as unknown as RefundedArgs);
          break;
        default:
          if (ev.eventName === "FeeCollected") {
            await recordEvent(tx, deps, block, {
              log: ev,
              eventType: "FeeCollected",
              marketAddress: toAddress(ev.address),
              args: ev.args,
            });
          }
          // Paused / Unpaused / OwnershipTransferred are housekeeping, not
          // part of the indexed protocol surface (see docs/contracts.md).
      }
    }

    return { createdMarkets: createdEvents.length, events: marketEvents.length };
  });
}

// ---------------------------------------------------------------------------
// Reorg rollback
// ---------------------------------------------------------------------------

/**
 * Delete every projection written for blocks >= `fromBlock` (reorg rewind).
 * chain_events is the raw registry; trades/claims/refunds/snapshots reference
 * it via tx_hash/market_address. Markets whose MarketCreated event is in the
 * window are deleted too — they are recreated when the window is re-backfilled.
 */
export async function rollbackProjections(
  sql: postgres.Sql,
  chainId: number,
  fromBlock: bigint,
): Promise<void> {
  const from = Number(fromBlock);
  await sql.begin(async (tx) => {
    await tx`
      DELETE FROM trades
       WHERE chain_id = ${chainId}
         AND tx_hash IN (
           SELECT tx_hash FROM chain_events
            WHERE chain_id = ${chainId} AND block_number >= ${from}
         )`;
    await tx`
      DELETE FROM claims
       WHERE chain_id = ${chainId}
         AND tx_hash IN (
           SELECT tx_hash FROM chain_events
            WHERE chain_id = ${chainId} AND block_number >= ${from}
         )`;
    await tx`
      DELETE FROM refunds
       WHERE chain_id = ${chainId}
         AND tx_hash IN (
           SELECT tx_hash FROM chain_events
            WHERE chain_id = ${chainId} AND block_number >= ${from}
         )`;
    await tx`
      DELETE FROM market_snapshots
       WHERE market_chain_id = ${chainId}
         AND market_address IN (
           SELECT market_address FROM chain_events
            WHERE chain_id = ${chainId} AND block_number >= ${from}
         )`;
    await tx`
      DELETE FROM markets
       WHERE chain_id = ${chainId}
         AND address IN (
           SELECT market_address FROM chain_events
            WHERE chain_id = ${chainId} AND event_type = 'MarketCreated'
              AND block_number >= ${from}
         )`;
    await tx`
      DELETE FROM chain_events
       WHERE chain_id = ${chainId} AND block_number >= ${from}`;
  });
}
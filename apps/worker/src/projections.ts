/**
 * Phase 3 projections for the chain indexer.
 *
 * Decodes `MarketCreated` (factory) and `BinaryPoolMarket` events into
 * idempotent PostgreSQL projections:
 *
 *   chain_events      → every decoded event (identity: chain + tx + logIndex)
 *   markets           → upserted from MarketCreated; status/pools from lifecycle events
 *   trades            → PositionEntered (attribution SESSION_CORRELATED when a
 *                       pending trade_attributions row matches, else UNKNOWN)
 *   claims            → Claimed (gross = net + fee)
 *   refunds           → Refunded
 *   market_snapshots  → one row per PositionEntered (pool trajectory for charts)
 *
 * Idempotency: a `chain_events` insert that conflicts (already processed) is
 * a no-op, and projections are only written when the event is newly recorded.
 * The whole block is one transaction, so a failed projection rolls back the
 * block's raw events too; the cursor never advances past a failed block.
 */
import { and, eq, sql as drizzleSql } from "drizzle-orm";
import postgres from "postgres";
import {
  binaryPoolMarketAbi,
  marketFactoryAbi,
  predictionEntryRouterAbi,
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
  tradeAttributions,
  trades,
  type Database,
} from "@pl/database";
import {
  parseEventLogs,
  TransactionReceiptNotFoundError,
  type Address,
  type Log,
  type PublicClient,
} from "viem";

import {
  erc20TransferEvent,
  isErc20TransferLog,
  projectTokenTransfers,
  type TransferLog,
} from "./tokens.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Db = Pick<Database, "insert" | "select" | "update" | "delete" | "query" | "execute">;

export interface ProjectionDeps {
  chainId: number;
  factoryAddress: Address;
  entryRouterAddress?: Address;
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

interface FundingRoutedArgs {
  user: Address;
  market: Address;
  fundingToken: Address;
  fundingAmount: bigint;
  usdgAmount: bigint;
  side: number;
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
  if (
    !(await recordEvent(tx, deps, block, {
      log: ev,
      eventType: "MarketCreated",
      marketAddress: market,
      args,
    }))
  ) {
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

/**
 * Session-correlated funding-token attribution (Phase 4). The API records a
 * pending (swapTx → enterTx) correlation; the worker only trusts it after
 * verifying the enter tx exists (we are projecting it now) and that the
 * correlated wallet matches the trader. This is SESSION_CORRELATED — an
 * honest, non-trustless attribution level.
 */
async function resolveSessionAttribution(
  tx: Db,
  deps: ProjectionDeps & { client: PublicClient },
  txHash: string,
  wallet: Address,
  blockNumber: bigint,
  transactionIndex: number,
): Promise<
  { fundingTokenAddress: string | null; fundingAmount: string | null } & (
    | { attribution: "SESSION_CORRELATED"; attributionId: number }
    | { attribution: "UNKNOWN"; attributionId: null }
  )
> {
  if (!txHash)
    return {
      attribution: "UNKNOWN" as const,
      attributionId: null,
      fundingTokenAddress: null,
      fundingAmount: null,
    };
  await tx.execute(
    drizzleSql`select pg_advisory_xact_lock(hashtext(${`${deps.chainId}:${txHash}`}))`,
  );
  const rows = await tx
    .select({
      id: tradeAttributions.id,
      wallet: tradeAttributions.wallet,
      fundingTokenAddress: tradeAttributions.fundingTokenAddress,
      fundingAmount: tradeAttributions.fundingAmount,
      status: tradeAttributions.status,
      swapTxHash: tradeAttributions.swapTxHash,
    })
    .from(tradeAttributions)
    .where(
      and(
        eq(tradeAttributions.chainId, deps.chainId),
        eq(tradeAttributions.enterTxHash, txHash.toLowerCase()),
        eq(tradeAttributions.status, "PENDING"),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row || row.wallet !== wallet) {
    return {
      attribution: "UNKNOWN" as const,
      attributionId: null,
      fundingTokenAddress: null,
      fundingAmount: null,
    };
  }
  // A previously validated swap can be orphaned by a reorg. Recheck its
  // canonical receipt before restoring a pending correlation on replay.
  let canonicalSwap = false;
  try {
    const receipt = await deps.client.getTransactionReceipt({
      hash: row.swapTxHash as `0x${string}`,
    });
    canonicalSwap =
      receipt.status === "success" &&
      (receipt.blockNumber < blockNumber ||
        (receipt.blockNumber === blockNumber && receipt.transactionIndex < transactionIndex));
  } catch (err) {
    if (!(err instanceof TransactionReceiptNotFoundError)) throw err;
  }
  if (!canonicalSwap) {
    await tx
      .update(tradeAttributions)
      .set({ status: "REJECTED", rejectionReason: "swap_not_canonical" })
      .where(eq(tradeAttributions.id, row.id));
    return {
      attribution: "UNKNOWN",
      attributionId: null,
      fundingTokenAddress: null,
      fundingAmount: null,
    };
  }
  await tx
    .update(tradeAttributions)
    .set({ status: "CONFIRMED", confirmedAt: new Date() })
    .where(eq(tradeAttributions.id, row.id));
  return {
    attribution: "SESSION_CORRELATED" as const,
    attributionId: row.id,
    fundingTokenAddress: row.fundingTokenAddress,
    fundingAmount: row.fundingAmount,
  };
}

async function projectPositionEntered(
  tx: Db,
  deps: ProjectionDeps & { client: PublicClient },
  block: BlockRef,
  ev: Log,
  args: PositionEnteredArgs,
  onchainAttribution?: FundingRoutedArgs,
): Promise<void> {
  const market = toAddress(ev.address);
  if (
    !(await recordEvent(tx, deps, block, {
      log: ev,
      eventType: "PositionEntered",
      marketAddress: market,
      args,
    }))
  ) {
    return;
  }

  const side = SIDE_BY_CODE[args.side];
  if (!side) {
    console.warn(`[worker] PositionEntered with unknown side ${args.side} at ${market}`);
    return;
  }
  const timestamp = toDate(block.timestamp);

  const attribution =
    onchainAttribution &&
    toAddress(onchainAttribution.user) === toAddress(args.user) &&
    toAddress(onchainAttribution.market) === market &&
    onchainAttribution.usdgAmount === args.amount &&
    onchainAttribution.side === args.side
      ? {
          attribution: "ONCHAIN" as const,
          attributionId: null,
          fundingTokenAddress: toAddress(onchainAttribution.fundingToken),
          fundingAmount: onchainAttribution.fundingAmount.toString(),
        }
      : await resolveSessionAttribution(
          tx,
          deps,
          (ev.transactionHash ?? "").toLowerCase(),
          toAddress(args.user),
          block.number,
          ev.transactionIndex ?? 0,
        );

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
      fundingTokenChainId: attribution.fundingTokenAddress ? deps.chainId : null,
      fundingTokenAddress: attribution.fundingTokenAddress,
      fundingAmount: attribution.fundingAmount,
      attribution: attribution.attribution,
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

async function projectMarketLocked(
  tx: Db,
  deps: ProjectionDeps,
  block: BlockRef,
  ev: Log,
): Promise<void> {
  const market = toAddress(ev.address);
  if (
    !(await recordEvent(tx, deps, block, {
      log: ev,
      eventType: "MarketLocked",
      marketAddress: market,
      args: {},
    }))
  ) {
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
  if (
    !(await recordEvent(tx, deps, block, {
      log: ev,
      eventType: "MarketResolved",
      marketAddress: market,
      args,
    }))
  ) {
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
  if (
    !(await recordEvent(tx, deps, block, {
      log: ev,
      eventType: "MarketCancelled",
      marketAddress: market,
      args: {},
    }))
  ) {
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
  if (
    !(await recordEvent(tx, deps, block, {
      log: ev,
      eventType: "Claimed",
      marketAddress: market,
      args,
    }))
  ) {
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
  if (
    !(await recordEvent(tx, deps, block, {
      log: ev,
      eventType: "Refunded",
      marketAddress: market,
      args,
    }))
  ) {
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
): Promise<{ createdMarkets: number; events: number; transfers: number; newTokens: Address[] }> {
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
    const routedByTransaction = new Map<string, FundingRoutedArgs>();
    if (deps.entryRouterAddress) {
      const routerLogs = await deps.client.getLogs({
        address: deps.entryRouterAddress,
        fromBlock: block.number,
        toBlock: block.number,
      });
      const routedEvents = parseEventLogs({
        abi: predictionEntryRouterAbi,
        logs: routerLogs,
        eventName: "FundingRouted",
      });
      for (const event of routedEvents) {
        const args = event.args as unknown as FundingRoutedArgs;
        await recordEvent(tx, deps, block, {
          log: event,
          eventType: "FundingRouted",
          marketAddress: toAddress(args.market),
          args,
        });
        routedByTransaction.set((event.transactionHash ?? "").toLowerCase(), args);
      }
    }

    for (const ev of marketEvents) {
      switch (ev.eventName) {
        case "PositionEntered":
          await projectPositionEntered(
            tx,
            deps,
            block,
            ev,
            ev.args as unknown as PositionEnteredArgs,
            routedByTransaction.get((ev.transactionHash ?? "").toLowerCase()),
          );
          break;
        case "MarketLocked":
          await projectMarketLocked(tx, deps, block, ev);
          break;
        case "MarketResolved":
          await projectMarketResolved(
            tx,
            deps,
            block,
            ev,
            ev.args as unknown as MarketResolvedArgs,
          );
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

    // Full-chain ERC-20 wallet scan (Phase 4 funding-token discovery): every
    // Transfer log, no address filter. ERC-721 Transfers share the topic0
    // signature but have a fourth indexed topic and are filtered out.
    const transferLogsRaw = await deps.client.getLogs({
      fromBlock: block.number,
      toBlock: block.number,
      event: erc20TransferEvent,
      strict: true,
    });
    const transferLogs: TransferLog[] = transferLogsRaw.filter(isErc20TransferLog).map((log) => ({
      address: toAddress(log.address),
      transactionHash: log.transactionHash,
      logIndex: log.logIndex,
      args: log.args as unknown as TransferLog["args"],
    }));
    const { transfers, newTokens } = await projectTokenTransfers(tx, deps, block, transferLogs);

    return {
      createdMarkets: createdEvents.length,
      events: marketEvents.length,
      transfers,
      newTokens,
    };
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
    // Phase 4: transfers are append-only and balances aggregate on read, so
    // deleting the window rewinds balances. Attributions whose enter tx was
    // rolled back go back to PENDING so a re-included entry re-correlates.
    // Both must run before the chain_events delete below — the attribution
    // reset looks up the window's PositionEntered txs there.
    await tx`
      DELETE FROM token_transfers
       WHERE chain_id = ${chainId} AND block_number >= ${from}`;
    await tx`
      UPDATE trade_attributions
         SET status = 'PENDING', confirmed_at = NULL
       WHERE chain_id = ${chainId}
         AND enter_tx_hash IN (
           SELECT tx_hash FROM chain_events
            WHERE chain_id = ${chainId} AND event_type = 'PositionEntered'
              AND block_number >= ${from}
         )`;
    await tx`
      DELETE FROM chain_events
       WHERE chain_id = ${chainId} AND block_number >= ${from}`;
  });
}

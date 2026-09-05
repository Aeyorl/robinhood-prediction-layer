/**
 * Phase 4 funding-token discovery projections.
 *
 * The indexer watches every ERC-20 `Transfer(address,address,uint256)` log on
 * the chain (wallet-scan discovery — no hardcoded token list) and writes:
 *
 *   tokens          → one row per observed token (identity: chain + address;
 *                     symbol/name/decimals are lazy display metadata fetched
 *                     outside the block transaction — never symbol-based trust)
 *   token_transfers → append-only transfer log; balances are aggregated on
 *                     read, so reorg rollback automatically rewinds balances
 *
 * Idempotency mirrors the market projections: the (chainId, txHash, logIndex)
 * unique index gates every write, and ERC-721 Transfers (4 indexed topics) are
 * excluded because they share the same topic0 signature.
 */
import { and, eq, inArray } from "drizzle-orm";
import { parseAbiItem, type Address, type PublicClient } from "viem";

import { tokens, tokenTransfers, type Database } from "@pl/database";

import type { BlockRef, ProjectionDeps } from "./projections.js";

export const erc20TransferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

type Db = Pick<Database, "insert" | "select" | "update" | "delete" | "query">;

export interface TransferLog {
  address: Address;
  transactionHash?: string;
  logIndex?: number;
  args: { from: Address; to: Address; value: bigint };
}

function toAddress(value: string): Address {
  return value.toLowerCase() as Address;
}

/** ERC-20 Transfers have topic0 + 2 indexed params; ERC-721 has a fourth. */
export function isErc20TransferLog(log: { topics: readonly `0x${string}`[] }): boolean {
  return log.topics.length === 3;
}

/**
 * Append every ERC-20 Transfer in the block to `token_transfers` and register
 * newly observed tokens. Runs inside the block transaction. Returns the token
 * addresses needing metadata fetch (PENDING rows).
 */
export async function projectTokenTransfers(
  tx: Db,
  deps: ProjectionDeps,
  block: BlockRef,
  logs: TransferLog[],
): Promise<{ transfers: number; newTokens: Address[] }> {
  const pendingMetadata = new Set<Address>();
  let transfers = 0;

  for (const ev of logs) {
    if (!ev.transactionHash) continue;
    const token = toAddress(ev.address);
    const inserted = await tx
      .insert(tokenTransfers)
      .values({
        chainId: deps.chainId,
        txHash: ev.transactionHash,
        logIndex: Number(ev.logIndex ?? 0),
        blockNumber: Number(block.number),
        blockHash: block.hash,
        tokenAddress: token,
        fromAddress: toAddress(ev.args.from),
        toAddress: toAddress(ev.args.to),
        value: ev.args.value.toString(),
        timestamp: new Date(Number(block.timestamp) * 1000),
      })
      .onConflictDoNothing()
      .returning({ id: tokenTransfers.id });

    if (inserted.length === 0) continue;
    transfers += 1;

    // Register the token identity (metadata arrives via the separate fetch).
    await tx
      .insert(tokens)
      .values({
        chainId: deps.chainId,
        address: token,
        metadataStatus: "PENDING",
        supportStatus: "DISCOVERED",
        firstSeenBlock: Number(block.number),
      })
      .onConflictDoNothing();
    pendingMetadata.add(token);
  }

  return { transfers, newTokens: [...pendingMetadata] };
}

/**
 * Fetch symbol/name/decimals for PENDING tokens with guarded reads. Weird
 * tokens (reverting symbol(), wrong return types) are marked UNREADABLE and
 * stay DISCOVERED-unsafe — the row is never fabricated. Called AFTER the
 * block transaction commits so an RPC hang cannot hold the tx open.
 */
export async function fetchTokenMetadata(
  client: PublicClient,
  db: Database,
  chainId: number,
  candidates: Iterable<Address>,
): Promise<number> {
  const addresses = [...candidates];
  if (addresses.length === 0) return 0;

  // The database owns metadata state; no unbounded process cache or stale
  // cache entries after rebuilding the projection database.
  const rows = await db
    .select({ address: tokens.address, metadataStatus: tokens.metadataStatus })
    .from(tokens)
    .where(and(eq(tokens.chainId, chainId), inArray(tokens.address, addresses)));

  let fetched = 0;
  for (const row of rows) {
    if (row.metadataStatus !== "PENDING") {
      continue;
    }
    const address = row.address as Address;
    let symbol: string | null = null;
    let name: string | null = null;
    let decimals: number | null = null;
    let ok = true;
    try {
      symbol = (await client.readContract({
        address,
        abi: erc20MetadataAbi,
        functionName: "symbol",
      })) as string;
      decimals = Number(
        await client.readContract({ address, abi: erc20MetadataAbi, functionName: "decimals" }),
      );
      name = (await client.readContract({
        address,
        abi: erc20MetadataAbi,
        functionName: "name",
      })) as string;
    } catch {
      ok = false; // honeypot/weird metadata — display fields stay null
    }
    await db
      .update(tokens)
      .set({
        symbol,
        name,
        decimals,
        metadataStatus: ok ? "OK" : "UNREADABLE",
        updatedAt: new Date(),
      })
      .where(and(eq(tokens.chainId, chainId), eq(tokens.address, address)));
    fetched += 1;
  }
  return fetched;
}

const erc20MetadataAbi = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

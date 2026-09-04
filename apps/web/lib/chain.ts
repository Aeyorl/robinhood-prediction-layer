import { binaryPoolMarketAbi, mockErc20Abi } from "@pl/sdk";
import { createPublicClient, http, type Address, type PublicClient } from "viem";

import { getChain } from "@pl/chain-config";

import { getLocalManifest, type LocalDeployment } from "@/lib/server/manifest";

export const ACTIVE_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 46630);

/** True when NEXT_PUBLIC_LOCAL_CHAIN=true (anvil on 127.0.0.1:8545). */
export function isLocalChainEnv(): boolean {
  return process.env.NEXT_PUBLIC_LOCAL_CHAIN === "true";
}

export const LOCAL_RPC_URL = "http://127.0.0.1:8545";

export function localRpcUrl(): string | undefined {
  if (!isLocalChainEnv()) return undefined;
  // Local mode points the Robinhood Chain testnet id (46630) at anvil.
  return ACTIVE_CHAIN_ID === 4663 ? process.env.NEXT_PUBLIC_RPC_MAINNET : LOCAL_RPC_URL;
}

function rpcUrl(): string | undefined {
  const override =
    ACTIVE_CHAIN_ID === 4663
      ? process.env.NEXT_PUBLIC_RPC_MAINNET
      : process.env.NEXT_PUBLIC_RPC_TESTNET;
  return override || localRpcUrl(); // undefined → chain default RPC
}

export function makePublicClient(): PublicClient {
  return createPublicClient({ chain: getChain(ACTIVE_CHAIN_ID), transport: http(rpcUrl()) });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarketCatalogEntry {
  address: Address;
  slug: string;
  question: string;
  comparator: "PRICE_ABOVE_AT_TIME" | "PRICE_BELOW_AT_TIME";
  strike: string;
  strikeDecimals: number;
  asset: { address: Address; symbol: string; name: string };
  feed: Address;
  heartbeatSeconds: number;
  feeBps: bigint;
  openTime: bigint;
  lockTime: bigint;
  resolutionTime: bigint;
  gracePeriodSeconds: bigint;
  minEntry: bigint;
  maxEntry: bigint | null;
  collateral: Address;
}

export interface MarketState {
  status: number; // 0 OPEN, 1 LOCKED, 2 RESOLVED, 3 CANCELLED
  winningOutcome: number; // 0 NONE, 1 YES, 2 NO
  resolvedPrice: bigint;
  resolvedAt: bigint;
  yesPool: bigint;
  noPool: bigint;
}

export interface MarketWithState extends MarketCatalogEntry, MarketState {}

const MARKET_STATUS = ["OPEN", "LOCKED", "RESOLVED", "CANCELLED"] as const;
const SIDE = ["NONE", "YES", "NO"] as const;

export function statusLabel(status: number): string {
  return MARKET_STATUS[status] ?? "UNKNOWN";
}

export function sideLabel(outcome: number): string {
  return SIDE[outcome] ?? "NONE";
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function catalogFromManifest(manifest: LocalDeployment): MarketCatalogEntry[] {
  const usdg = manifest.mocks["USDG"];
  if (!usdg) throw new Error("USDG mock missing from manifest");
  return manifest.markets.map((m) => {
    const assetSymbol =
      Object.entries(manifest.mocks).find(([, v]) => v.address === m.asset)?.[1]?.symbol ?? "?";
    return {
      address: m.address as Address,
      slug: m.slug,
      question: m.question,
      comparator: m.comparator as "PRICE_ABOVE_AT_TIME" | "PRICE_BELOW_AT_TIME",
      strike: m.strike,
      strikeDecimals: m.strikeDecimals,
      asset: { address: m.asset as Address, symbol: assetSymbol, name: assetSymbol },
      feed: m.feed as Address,
      heartbeatSeconds: m.heartbeatSeconds,
      feeBps: BigInt(m.feeBps),
      openTime: BigInt(m.openTime),
      lockTime: BigInt(m.lockTime),
      resolutionTime: BigInt(m.resolutionTime),
      gracePeriodSeconds: BigInt(m.gracePeriodSeconds),
      minEntry: BigInt(m.minEntry),
      maxEntry: m.maxEntry ? BigInt(m.maxEntry) : null,
      collateral: m.asset === manifest.usdg ? (m.asset as Address) : (manifest.usdg as Address),
    };
  });
}

/**
 * Reads live pool/status state for one market. Direct parallel reads (no
 * multicall3 dependency — anvil and some testnets don't deploy it).
 */
export async function readMarketState(client: PublicClient, market: Address): Promise<MarketState> {
  const read = <T>(functionName: string, args: unknown[] = []): Promise<T> =>
    client.readContract({
      address: market,
      abi: binaryPoolMarketAbi,
      functionName,
      args,
    }) as Promise<T>;

  const [status, winningOutcome, resolvedPrice, resolvedAt, yesPool, noPool] = await Promise.all([
    read<bigint>("status"),
    read<bigint>("winningOutcome"),
    read<bigint>("resolvedPrice"),
    read<bigint>("resolvedAt"),
    read<bigint>("yesPool"),
    read<bigint>("noPool"),
  ]);
  return {
    status: Number(status),
    winningOutcome: Number(winningOutcome),
    resolvedPrice,
    resolvedAt,
    yesPool,
    noPool,
  };
}

export async function readMarketsWithState(): Promise<MarketWithState[]> {
  const manifest = getLocalManifest();
  const client = makePublicClient();
  const catalog = catalogFromManifest(manifest);
  const markets: MarketWithState[] = [];
  for (const entry of catalog) {
    const state = await readMarketState(client, entry.address);
    markets.push({ ...entry, ...state });
  }
  return markets;
}

export async function readUsdgBalanceOf(
  client: PublicClient,
  usdg: Address,
  who: Address,
): Promise<bigint> {
  const result = await client.readContract({
    address: usdg,
    abi: mockErc20Abi,
    functionName: "balanceOf",
    args: [who],
  });
  return result as bigint;
}

export interface UserMarketState {
  yesStake: bigint;
  noStake: bigint;
  hasClaimed: boolean;
}

/** Per-wallet stake + claim state for one market (parallel direct reads). */
export async function readUserMarketState(
  client: PublicClient,
  market: Address,
  user: Address,
): Promise<UserMarketState> {
  const read = <T>(functionName: string): Promise<T> =>
    client.readContract({
      address: market,
      abi: binaryPoolMarketAbi,
      functionName,
      args: [user],
    }) as Promise<T>;
  const [yesStake, noStake, hasClaimed] = await Promise.all([
    read<bigint>("userYesStake"),
    read<bigint>("userNoStake"),
    read<boolean>("hasClaimed"),
  ]);
  return { yesStake, noStake, hasClaimed };
}

export async function readErc20Allowance(
  client: PublicClient,
  token: Address,
  owner: Address,
  spender: Address,
): Promise<bigint> {
  const result = await client.readContract({
    address: token,
    abi: mockErc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  });
  return result as bigint;
}

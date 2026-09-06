import {
  ACTIVE_CHAIN_ID,
  catalogFromManifest,
  isLocalChainEnv,
  makePublicClient,
  readMarketState,
  type MarketCatalogEntry,
  type MarketState,
} from "@/lib/chain";
import { makeMarketView, type MarketView } from "@/lib/market-view";
import { z } from "zod";

import { getLocalManifest, hasLocalManifest } from "./manifest";

/**
 * Server-side market loading for Phase 2. Reads the local deployment
 * manifest (packages/contracts/deployments/local.json) plus live onchain
 * state through viem. This path is authoritative — it never fabricates
 * pools or statuses. It requires a local anvil chain with the contracts
 * deployed; when the chain/manifest is missing, pages render the honest
 * "no local chain" state instead of faking data.
 */

export interface LoadedMarkets {
  chainId: number;
  views: MarketView[];
}

const apiMarketSchema = z.object({
  chainId: z.number(),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  slug: z.string(),
  question: z.string(),
  comparator: z.enum(["PRICE_ABOVE_AT_TIME", "PRICE_BELOW_AT_TIME"]),
  strike: z.string(),
  strikeDecimals: z.number().int().nonnegative(),
  collateral: z.object({ address: z.string().regex(/^0x[a-fA-F0-9]{40}$/) }),
  oracleAsset: z.object({ address: z.string().regex(/^0x[a-fA-F0-9]{40}$/) }),
  assetSymbol: z.string().min(1),
  feed: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  feeBps: z.number().int().nonnegative(),
  openTime: z.iso.datetime(),
  lockTime: z.iso.datetime(),
  resolutionTime: z.iso.datetime(),
  gracePeriodSeconds: z.number().int().nonnegative(),
  minEntry: z.string().regex(/^\d+$/),
  status: z.enum(["OPEN", "LOCKED", "RESOLVED", "CANCELLED"]),
  winningOutcome: z.enum(["YES", "NO"]).nullable(),
  resolvedPrice: z.string().nullable(),
  resolvedAt: z.iso.datetime().nullable(),
  yesPool: z.string().regex(/^\d+$/),
  noPool: z.string().regex(/^\d+$/),
});

const apiMarketsSchema = z.object({ markets: z.array(apiMarketSchema) });

function statusCode(status: z.infer<typeof apiMarketSchema>["status"]): number {
  return status === "LOCKED" ? 1 : status === "RESOLVED" ? 2 : status === "CANCELLED" ? 3 : 0;
}

function outcomeCode(outcome: z.infer<typeof apiMarketSchema>["winningOutcome"]): number {
  return outcome === "YES" ? 1 : outcome === "NO" ? 2 : 0;
}

function unixSeconds(value: string): number {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error(`Invalid market timestamp: ${value}`);
  return Math.floor(milliseconds / 1_000);
}

async function loadIndexedMarketViews(): Promise<LoadedMarkets> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL is required outside local-chain mode");
  const response = await fetch(new URL("/v1/markets?limit=100", apiUrl), { cache: "no-store" });
  if (!response.ok) throw new Error(`Market API returned ${response.status}`);
  const parsed = apiMarketsSchema.parse(await response.json());
  const views = parsed.markets.map((market) =>
    makeMarketView({
      chainId: market.chainId,
      address: market.address,
      slug: market.slug,
      question: market.question,
      assetSymbol: market.assetSymbol,
      assetAddress: market.oracleAsset.address,
      comparator: market.comparator,
      strike: market.strike,
      strikeDecimals: market.strikeDecimals,
      collateralSymbol: "USDG",
      collateral: market.collateral.address,
      feeBps: market.feeBps.toString(),
      minEntry: market.minEntry,
      openTime: unixSeconds(market.openTime),
      lockTime: unixSeconds(market.lockTime),
      resolutionTime: unixSeconds(market.resolutionTime),
      gracePeriodSeconds: market.gracePeriodSeconds,
      feed: market.feed,
      status: statusCode(market.status),
      side: outcomeCode(market.winningOutcome),
      resolvedPrice: market.resolvedPrice ?? "0",
      resolvedAt: market.resolvedAt ? unixSeconds(market.resolvedAt) : 0,
      yesPool: market.yesPool,
      noPool: market.noPool,
    }),
  );
  return { chainId: ACTIVE_CHAIN_ID, views };
}

function toView(entry: MarketCatalogEntry, state: MarketState): MarketView {
  return makeMarketView({
    chainId: ACTIVE_CHAIN_ID,
    address: entry.address,
    slug: entry.slug,
    question: entry.question,
    assetSymbol: entry.asset.symbol,
    assetAddress: entry.asset.address,
    comparator: entry.comparator,
    strike: entry.strike,
    strikeDecimals: entry.strikeDecimals,
    collateralSymbol: "USDG",
    collateral: entry.collateral,
    feeBps: entry.feeBps.toString(),
    minEntry: entry.minEntry.toString(),
    openTime: Number(entry.openTime),
    lockTime: Number(entry.lockTime),
    resolutionTime: Number(entry.resolutionTime),
    gracePeriodSeconds: Number(entry.gracePeriodSeconds),
    feed: entry.feed,
    status: state.status,
    side: state.winningOutcome,
    resolvedPrice: state.resolvedPrice.toString(),
    resolvedAt: Number(state.resolvedAt),
    yesPool: state.yesPool.toString(),
    noPool: state.noPool.toString(),
  });
}

export function hasLocalDeployment(): boolean {
  return hasLocalManifest();
}

export async function loadMarketViews(): Promise<LoadedMarkets> {
  if (!isLocalChainEnv()) return loadIndexedMarketViews();
  const manifest = getLocalManifest();
  const client = makePublicClient();
  const views: MarketView[] = [];
  for (const entry of catalogFromManifest(manifest)) {
    const state = await readMarketState(client, entry.address);
    views.push(toView(entry, state));
  }
  return { chainId: ACTIVE_CHAIN_ID, views };
}

export async function loadMarketViewBySlug(slug: string): Promise<MarketView | null> {
  const { views } = await loadMarketViews();
  return views.find((v) => v.slug === slug) ?? null;
}

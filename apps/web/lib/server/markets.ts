import {
  ACTIVE_CHAIN_ID,
  catalogFromManifest,
  makePublicClient,
  readMarketState,
  type MarketCatalogEntry,
  type MarketState,
} from "@/lib/chain";
import { makeMarketView, type MarketView } from "@/lib/market-view";

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

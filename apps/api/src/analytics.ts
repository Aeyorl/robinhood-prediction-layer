import { and, eq, gte, inArray, isNotNull } from "drizzle-orm";

import { assets, markets, tokens, trades, type Database } from "@pl/database";

export const analyticsWindows = ["7d", "30d", "all"] as const;
export type AnalyticsWindow = (typeof analyticsWindows)[number];

export const verifiedAttributions = ["ONCHAIN", "SESSION_CORRELATED"] as const;
export const minimumRankedMarkets = 3;

type Side = "YES" | "NO";
type Result = "WIN" | "LOSS" | "NEUTRAL";

export interface AnalyticsRow {
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string | null;
  tokenName: string | null;
  tokenDecimals: number | null;
  tokenLogoUrl: string | null;
  marketChainId: number;
  marketAddress: string;
  marketSlug: string;
  question: string;
  status: "OPEN" | "LOCKED" | "RESOLVED" | "CANCELLED";
  winningOutcome: Side | null;
  feeBps: number;
  yesPool: string;
  noPool: string;
  resolvedAt: Date | null;
  wallet: string;
  side: Side;
  amountUsdg: string;
  timestamp: Date;
}

export interface MarketSplit {
  chainId: number;
  address: string;
  slug: string;
  question: string;
  status: AnalyticsRow["status"];
  winningOutcome: Side | null;
  yesVolumeUsdg: string;
  noVolumeUsdg: string;
  volumeUsdg: string;
  participantCount: number;
  yesShareBps: number | null;
  strongestSide: Side | null;
}

export interface RankedWallet {
  address: string;
  volumeUsdg: string;
  realizedPnlUsdg: string;
  roiBps: number | null;
  hitRateBps: number | null;
  resolvedMarkets: number;
  wins: number;
  losses: number;
  neutral: number;
  currentStreak: number;
  largestWinUsdg: string;
}

export interface CommunityAnalytics {
  chainId: number;
  tokenAddress: string;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  logoUrl: string | null;
  volumeUsdg: string;
  participantCount: number;
  marketCount: number;
  resolvedMarkets: number;
  wins: number;
  losses: number;
  neutral: number;
  realizedPnlUsdg: string;
  roiBps: number | null;
  hitRateBps: number | null;
  topCurrentStance: (MarketSplit & { shareBps: number }) | null;
  markets: MarketSplit[];
  topPredictors: RankedWallet[];
}

interface Position {
  wallet: string;
  marketKey: string;
  communityKey: string;
  market: AnalyticsRow;
  yes: bigint;
  no: bigint;
  lastEntryAt: Date;
}

interface PositionResult {
  position: Position;
  total: bigint;
  pnl: bigint | null;
  result: Result | null;
}

export function windowStart(window: AnalyticsWindow, now = new Date()): Date | null {
  if (window === "all") return null;
  const days = window === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function loadAnalyticsRows(
  db: Database,
  window: AnalyticsWindow,
  now = new Date(),
): Promise<AnalyticsRow[]> {
  const start = windowStart(window, now);
  const conditions = [
    inArray(trades.attribution, [...verifiedAttributions]),
    isNotNull(trades.fundingTokenChainId),
    isNotNull(trades.fundingTokenAddress),
  ];
  if (start) conditions.push(gte(trades.timestamp, start));

  const rows = await db
    .select({
      chainId: trades.fundingTokenChainId,
      tokenAddress: trades.fundingTokenAddress,
      tokenSymbol: tokens.symbol,
      tokenName: tokens.name,
      tokenDecimals: tokens.decimals,
      tokenLogoUrl: assets.logoUrl,
      marketChainId: trades.marketChainId,
      marketAddress: trades.marketAddress,
      marketSlug: markets.slug,
      question: markets.question,
      status: markets.status,
      winningOutcome: markets.winningOutcome,
      feeBps: markets.feeBps,
      yesPool: markets.yesPool,
      noPool: markets.noPool,
      resolvedAt: markets.resolvedAt,
      wallet: trades.wallet,
      side: trades.side,
      amountUsdg: trades.amountUsdg,
      timestamp: trades.timestamp,
      assetSymbol: assets.symbol,
      assetName: assets.name,
      assetDecimals: assets.decimals,
    })
    .from(trades)
    .innerJoin(
      markets,
      and(eq(markets.chainId, trades.marketChainId), eq(markets.address, trades.marketAddress)),
    )
    .leftJoin(
      tokens,
      and(
        eq(tokens.chainId, trades.fundingTokenChainId),
        eq(tokens.address, trades.fundingTokenAddress),
      ),
    )
    .leftJoin(
      assets,
      and(
        eq(assets.chainId, trades.fundingTokenChainId),
        eq(assets.address, trades.fundingTokenAddress),
      ),
    )
    .where(and(...conditions));

  return rows.map((row) => ({
    ...row,
    chainId: row.chainId!,
    tokenAddress: row.tokenAddress!,
    tokenSymbol: row.tokenSymbol ?? row.assetSymbol,
    tokenName: row.tokenName ?? row.assetName,
    tokenDecimals: row.tokenDecimals ?? row.assetDecimals,
  }));
}

function key(...parts: (string | number)[]) {
  return parts.join(":").toLowerCase();
}

function sum(values: bigint[]) {
  return values.reduce((total, value) => total + value, 0n);
}

function ratioBps(numerator: bigint | number, denominator: bigint | number): number | null {
  const n = BigInt(numerator);
  const d = BigInt(denominator);
  return d === 0n ? null : Number((n * 10_000n) / d);
}

function buildPositions(rows: AnalyticsRow[]): Position[] {
  const positions = new Map<string, Position>();
  for (const row of rows) {
    const communityKey = key(row.chainId, row.tokenAddress);
    const marketKey = key(row.marketChainId, row.marketAddress);
    const positionKey = key(communityKey, row.wallet, marketKey);
    const current = positions.get(positionKey) ?? {
      wallet: row.wallet,
      marketKey,
      communityKey,
      market: row,
      yes: 0n,
      no: 0n,
      lastEntryAt: row.timestamp,
    };
    current[row.side === "YES" ? "yes" : "no"] += BigInt(row.amountUsdg);
    if (row.timestamp > current.lastEntryAt) current.lastEntryAt = row.timestamp;
    positions.set(positionKey, current);
  }
  return [...positions.values()];
}

function resolvePosition(position: Position): PositionResult {
  const total = position.yes + position.no;
  if (position.market.status !== "RESOLVED" || !position.market.winningOutcome)
    return { position, total, pnl: null, result: null };
  const winningStake = position.market.winningOutcome === "YES" ? position.yes : position.no;
  const winningPool = BigInt(
    position.market.winningOutcome === "YES" ? position.market.yesPool : position.market.noPool,
  );
  const losingPool = BigInt(
    position.market.winningOutcome === "YES" ? position.market.noPool : position.market.yesPool,
  );
  let payout = 0n;
  if (winningStake > 0n && winningPool > 0n) {
    const gross = (winningStake * (winningPool + losingPool)) / winningPool;
    const fee = ((gross - winningStake) * BigInt(position.market.feeBps)) / 10_000n;
    payout = gross - fee;
  }
  const stance = position.yes === position.no ? null : position.yes > position.no ? "YES" : "NO";
  const result: Result =
    stance == null ? "NEUTRAL" : stance === position.market.winningOutcome ? "WIN" : "LOSS";
  return { position, total, pnl: payout - total, result };
}

function rankWallets(results: PositionResult[], limit = 10): RankedWallet[] {
  const grouped = new Map<string, PositionResult[]>();
  for (const result of results) {
    const list = grouped.get(result.position.wallet) ?? [];
    list.push(result);
    grouped.set(result.position.wallet, list);
  }
  return [...grouped.entries()]
    .map(([address, walletResults]) => {
      const resolved = walletResults.filter((item) => item.result != null && item.pnl != null);
      const wins = resolved.filter((item) => item.result === "WIN").length;
      const losses = resolved.filter((item) => item.result === "LOSS").length;
      const neutral = resolved.filter((item) => item.result === "NEUTRAL").length;
      const volume = sum(walletResults.map((item) => item.total));
      const resolvedStake = sum(resolved.map((item) => item.total));
      const pnl = sum(resolved.map((item) => item.pnl!));
      const chronological = [...resolved]
        .filter((item) => item.result !== "NEUTRAL")
        .sort(
          (a, b) =>
            (b.position.market.resolvedAt ?? b.position.lastEntryAt).getTime() -
            (a.position.market.resolvedAt ?? a.position.lastEntryAt).getTime(),
        );
      const first = chronological[0]?.result;
      const streak = first
        ? chronological.findIndex((item) => item.result !== first) === -1
          ? chronological.length
          : chronological.findIndex((item) => item.result !== first)
        : 0;
      return {
        address,
        volumeUsdg: volume.toString(),
        realizedPnlUsdg: pnl.toString(),
        roiBps: ratioBps(pnl, resolvedStake),
        hitRateBps: ratioBps(wins, wins + losses),
        resolvedMarkets: new Set(resolved.map((item) => item.position.marketKey)).size,
        wins,
        losses,
        neutral,
        currentStreak: first === "LOSS" ? -streak : streak,
        largestWinUsdg: resolved
          .reduce((best, item) => (item.pnl! > best ? item.pnl! : best), 0n)
          .toString(),
      };
    })
    .sort(
      (a, b) =>
        Number(BigInt(b.realizedPnlUsdg) - BigInt(a.realizedPnlUsdg)) ||
        b.resolvedMarkets - a.resolvedMarkets ||
        a.address.localeCompare(b.address),
    )
    .slice(0, limit);
}

function marketSplits(rows: AnalyticsRow[]): MarketSplit[] {
  const grouped = new Map<string, AnalyticsRow[]>();
  for (const row of rows) {
    const list = grouped.get(key(row.marketChainId, row.marketAddress)) ?? [];
    list.push(row);
    grouped.set(key(row.marketChainId, row.marketAddress), list);
  }
  return [...grouped.values()]
    .map((items) => {
      const first = items[0]!;
      const yes = sum(items.filter((r) => r.side === "YES").map((r) => BigInt(r.amountUsdg)));
      const no = sum(items.filter((r) => r.side === "NO").map((r) => BigInt(r.amountUsdg)));
      const total = yes + no;
      const strongestSide: Side | null = yes === no ? null : yes > no ? "YES" : "NO";
      return {
        chainId: first.marketChainId,
        address: first.marketAddress,
        slug: first.marketSlug,
        question: first.question,
        status: first.status,
        winningOutcome: first.winningOutcome,
        yesVolumeUsdg: yes.toString(),
        noVolumeUsdg: no.toString(),
        volumeUsdg: total.toString(),
        participantCount: new Set(items.map((r) => r.wallet)).size,
        yesShareBps: ratioBps(yes, total),
        strongestSide,
      };
    })
    .sort((a, b) => Number(BigInt(b.volumeUsdg) - BigInt(a.volumeUsdg)));
}

export function buildCommunityAnalytics(rows: AnalyticsRow[]): CommunityAnalytics[] {
  const grouped = new Map<string, AnalyticsRow[]>();
  for (const row of rows) {
    const communityKey = key(row.chainId, row.tokenAddress);
    const list = grouped.get(communityKey) ?? [];
    list.push(row);
    grouped.set(communityKey, list);
  }
  return [...grouped.values()]
    .map((items) => {
      const first = items[0]!;
      const results = buildPositions(items).map(resolvePosition);
      const resolved = results.filter((item) => item.result != null && item.pnl != null);
      const wins = resolved.filter((item) => item.result === "WIN").length;
      const losses = resolved.filter((item) => item.result === "LOSS").length;
      const neutral = resolved.filter((item) => item.result === "NEUTRAL").length;
      const volume = sum(items.map((item) => BigInt(item.amountUsdg)));
      const resolvedStake = sum(resolved.map((item) => item.total));
      const pnl = sum(resolved.map((item) => item.pnl!));
      const markets = marketSplits(items);
      const topCurrent = markets
        .filter((market) => market.status === "OPEN" || market.status === "LOCKED")
        .map((market) => ({
          ...market,
          shareBps:
            market.yesShareBps == null
              ? 0
              : market.strongestSide === "YES"
                ? market.yesShareBps
                : 10_000 - market.yesShareBps,
        }))
        .sort(
          (a, b) => b.shareBps - a.shareBps || Number(BigInt(b.volumeUsdg) - BigInt(a.volumeUsdg)),
        )[0];
      return {
        chainId: first.chainId,
        tokenAddress: first.tokenAddress,
        symbol: first.tokenSymbol,
        name: first.tokenName,
        decimals: first.tokenDecimals,
        logoUrl: first.tokenLogoUrl,
        volumeUsdg: volume.toString(),
        participantCount: new Set(items.map((item) => item.wallet)).size,
        marketCount: new Set(items.map((item) => key(item.marketChainId, item.marketAddress))).size,
        resolvedMarkets: new Set(resolved.map((item) => item.position.marketKey)).size,
        wins,
        losses,
        neutral,
        realizedPnlUsdg: pnl.toString(),
        roiBps: ratioBps(pnl, resolvedStake),
        hitRateBps: ratioBps(wins, wins + losses),
        topCurrentStance: topCurrent ?? null,
        markets,
        topPredictors: rankWallets(results),
      };
    })
    .sort(
      (a, b) =>
        Number(BigInt(b.volumeUsdg) - BigInt(a.volumeUsdg)) ||
        key(a.chainId, a.tokenAddress).localeCompare(key(b.chainId, b.tokenAddress)),
    );
}

export function buildWalletLeaderboard(rows: AnalyticsRow[]): RankedWallet[] {
  const byWalletMarket = new Map<string, Position>();
  for (const position of buildPositions(rows)) {
    const walletMarketKey = key(position.wallet, position.marketKey);
    const current = byWalletMarket.get(walletMarketKey);
    if (!current) {
      byWalletMarket.set(walletMarketKey, { ...position });
      continue;
    }
    current.yes += position.yes;
    current.no += position.no;
    if (position.lastEntryAt > current.lastEntryAt) current.lastEntryAt = position.lastEntryAt;
  }
  return rankWallets([...byWalletMarket.values()].map(resolvePosition), Number.MAX_SAFE_INTEGER);
}

export function sortLeaderboard(
  entries: RankedWallet[],
  metric: "pnl" | "roi" | "hit_rate" | "volume",
): RankedWallet[] {
  const eligible =
    metric === "roi" || metric === "hit_rate"
      ? entries.filter((entry) => entry.resolvedMarkets >= minimumRankedMarkets)
      : entries;
  const value = (entry: RankedWallet) => {
    if (metric === "pnl") return BigInt(entry.realizedPnlUsdg);
    if (metric === "volume") return BigInt(entry.volumeUsdg);
    return BigInt(metric === "roi" ? (entry.roiBps ?? -1_000_000) : (entry.hitRateBps ?? -1));
  };
  return [...eligible].sort(
    (a, b) =>
      Number(value(b) - value(a)) ||
      b.resolvedMarkets - a.resolvedMarkets ||
      a.address.localeCompare(b.address),
  );
}

export function buildWalletProfile(rows: AnalyticsRow[], address: string) {
  const wallet = address.toLowerCase();
  const walletRows = rows.filter((row) => row.wallet === wallet);
  const ranking = buildWalletLeaderboard(walletRows)[0] ?? null;
  const communities = buildCommunityAnalytics(walletRows).map((community) => ({
    chainId: community.chainId,
    tokenAddress: community.tokenAddress,
    symbol: community.symbol,
    name: community.name,
    volumeUsdg: community.volumeUsdg,
    realizedPnlUsdg: community.realizedPnlUsdg,
    marketCount: community.marketCount,
  }));
  const recentPredictions = buildPositions(walletRows)
    .map(resolvePosition)
    .filter((item) => item.result != null)
    .sort(
      (a, b) =>
        (b.position.market.resolvedAt ?? b.position.lastEntryAt).getTime() -
        (a.position.market.resolvedAt ?? a.position.lastEntryAt).getTime(),
    )
    .slice(0, 20)
    .map((item) => ({
      marketChainId: item.position.market.marketChainId,
      marketAddress: item.position.market.marketAddress,
      marketSlug: item.position.market.marketSlug,
      question: item.position.market.question,
      winningOutcome: item.position.market.winningOutcome,
      result: item.result!,
      yesVolumeUsdg: item.position.yes.toString(),
      noVolumeUsdg: item.position.no.toString(),
      realizedPnlUsdg: item.pnl!.toString(),
      resolvedAt: (item.position.market.resolvedAt ?? item.position.lastEntryAt).toISOString(),
      fundingToken: {
        chainId: item.position.market.chainId,
        address: item.position.market.tokenAddress,
        symbol: item.position.market.tokenSymbol,
      },
    }));
  return { address: wallet, stats: ranking, communities, recentPredictions };
}

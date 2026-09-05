import Link from "next/link";

import { branding } from "@pl/config";
import { Button, Card, Section, StatusBadge } from "@pl/ui";

import { MarketCard } from "@/components/market-card";
import {
  AnalyticsUnavailable,
  CommunityCard,
  formatBps,
  formatUsdg,
  shortAddress,
} from "@/components/analytics";
import { NoLocalChain } from "@/components/no-local-chain";
import { WalletAssetsCard } from "@/components/wallet-assets-card";
import { getCommunities, getLeaderboard } from "@/lib/analytics-api";
import { isLocalChainEnv } from "@/lib/chain";
import type { MarketView } from "@/lib/market-view";
import { loadMarketViews } from "@/lib/server/markets";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let views: MarketView[] | null = null;
  let chainDown = false;
  try {
    views = (await loadMarketViews()).views;
  } catch {
    chainDown = true;
  }

  const byTotal = (a: MarketView, b: MarketView) =>
    Number(BigInt(b.totalPool) - BigInt(a.totalPool));
  const trending = views
    ? views
        .filter((v) => v.status === "OPEN" || v.status === "LOCKED")
        .sort(byTotal)
        .slice(0, 4)
    : [];
  const closingSoon = views
    ? views
        .filter((v) => v.status === "OPEN")
        .sort((a, b) => a.lockTime - b.lockTime)
        .slice(0, 4)
    : [];
  const priceFeedMarkets = views
    ? views
        .filter((v) => v.status !== "CANCELLED")
        .sort(byTotal)
        .slice(0, 4)
    : [];
  const recentlyResolved = views
    ? views
        .filter((v) => v.status === "RESOLVED" || v.status === "CANCELLED")
        .sort((a, b) => (b.resolvedAt ?? b.resolutionTime) - (a.resolvedAt ?? a.resolutionTime))
        .slice(0, 3)
    : [];

  const [communityResult, leaderboardResult] = await Promise.allSettled([
    getCommunities("7d"),
    getLeaderboard("pnl", "30d"),
  ]);
  const communities =
    communityResult.status === "fulfilled" ? communityResult.value.communities.slice(0, 2) : null;
  const predictors =
    leaderboardResult.status === "fulfilled" ? leaderboardResult.value.entries.slice(0, 3) : null;

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-white/[0.08] bg-slate-950/45 px-5 py-16 text-center shadow-2xl shadow-black/20 sm:px-10 sm:py-24">
        <div
          aria-hidden="true"
          className="absolute inset-x-[18%] top-0 -z-10 h-56 rounded-full bg-indigo-500/20 blur-3xl"
        />
        <div className="mx-auto max-w-4xl space-y-5">
          <StatusBadge tone="indigo">Objective markets · settled onchain</StatusBadge>
          <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
            Take a position on what happens next.
          </h1>
          <p className="mx-auto max-w-2xl text-pretty text-base leading-7 text-slate-300 sm:text-lg">
            Choose YES or NO on an objective market outcome and fund the position with supported
            assets already in your wallet.
          </p>
          <div className="flex flex-col justify-center gap-3 pt-3 sm:flex-row">
            <Link href="/markets" className="sm:min-w-44">
              <Button size="lg" className="w-full">
                Explore markets
              </Button>
            </Link>
            <Link href="/assets" className="sm:min-w-44">
              <Button size="lg" variant="secondary" className="w-full">
                Check wallet assets
              </Button>
            </Link>
          </div>
          <p className="pt-3 text-xs text-slate-500">
            Built on {branding.chainName}. Market ratios show capital share, not guaranteed
            probability.
          </p>
        </div>
      </section>

      {/* Connected wallet assets */}
      <WalletAssetsCard />

      {chainDown || views == null ? (
        <NoLocalChain />
      ) : views.length === 0 ? (
        <Section eyebrow="Live markets" title="No markets yet">
          <Card className="text-sm text-slate-400">
            The local deployment is reachable but has no markets. Deploy example markets with{" "}
            <code className="rounded bg-white/10 px-1 font-mono text-xs">pnpm contracts:local</code>{" "}
            to see live market state here.
          </Card>
        </Section>
      ) : (
        <>
          <div className="grid gap-8 lg:grid-cols-2">
            <Section eyebrow="Live markets" title="Trending">
              {trending.length === 0 ? (
                <Card className="text-sm text-slate-400">No open markets right now.</Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {trending.map((m) => (
                    <MarketCard key={m.address} market={m} />
                  ))}
                </div>
              )}
            </Section>
            <Section eyebrow="Live markets" title="Closing soon">
              {closingSoon.length === 0 ? (
                <Card className="text-sm text-slate-400">
                  No markets accepting entry right now.
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {closingSoon.map((m) => (
                    <MarketCard key={m.address} market={m} />
                  ))}
                </div>
              )}
            </Section>
          </div>

          <Section
            eyebrow={isLocalChainEnv() ? "Local demo tokens" : "Robinhood Chain"}
            title={isLocalChainEnv() ? "Price-feed markets (local demo)" : "Stock Token markets"}
          >
            {priceFeedMarkets.length === 0 ? (
              <Card className="text-sm text-slate-400">
                Objective price markets on Stock Tokens (Chainlink-backed feeds, staleness and
                sequencer checks) are enabled by the oracle resolver and will list here.
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {priceFeedMarkets.map((m) => (
                  <MarketCard key={m.address} market={m} />
                ))}
              </div>
            )}
          </Section>

          <Section eyebrow="History" title="Recently resolved">
            {recentlyResolved.length === 0 ? (
              <Card className="text-sm text-slate-400">
                Resolved markets with their winning outcome will appear here once markets settle.
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                {recentlyResolved.map((m) => (
                  <MarketCard key={m.address} market={m} />
                ))}
              </div>
            )}
          </Section>
        </>
      )}

      <div className="grid gap-10 lg:grid-cols-2">
        <Section eyebrow="Analytics" title="Community pulse">
          {communities == null ? (
            <AnalyticsUnavailable />
          ) : communities.length === 0 ? (
            <Card className="text-sm text-slate-400">
              No verified source-token activity in the last 7 days.
            </Card>
          ) : (
            <div className="grid gap-4">
              {communities.map((community) => (
                <CommunityCard
                  key={`${community.chainId}:${community.tokenAddress}`}
                  community={community}
                />
              ))}
            </div>
          )}
          <Link
            href="/communities"
            className="inline-flex text-sm font-semibold text-indigo-300 hover:text-indigo-200"
          >
            Explore communities →
          </Link>
        </Section>
        <Section eyebrow="30 day performance" title="Top predictors">
          {predictors == null ? (
            <AnalyticsUnavailable />
          ) : predictors.length === 0 ? (
            <Card className="text-sm text-slate-400">
              No wallets qualify for the 30-day ranking yet.
            </Card>
          ) : (
            <Card className="divide-y divide-white/[0.08] p-0">
              {predictors.map((predictor, index) => (
                <Link
                  key={predictor.address}
                  href={`/profile/${predictor.address}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/[0.04]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-bold text-slate-400">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-sm font-semibold text-white">
                      {shortAddress(predictor.address)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {predictor.resolvedMarkets} resolved · {formatBps(predictor.hitRateBps)} hit
                      rate
                    </span>
                  </span>
                  <span
                    className={
                      BigInt(predictor.realizedPnlUsdg) >= 0n
                        ? "text-sm font-semibold text-emerald-300"
                        : "text-sm font-semibold text-rose-300"
                    }
                  >
                    {formatUsdg(predictor.realizedPnlUsdg)}
                  </span>
                </Link>
              ))}
            </Card>
          )}
          <Link
            href="/leaderboard"
            className="inline-flex text-sm font-semibold text-indigo-300 hover:text-indigo-200"
          >
            View leaderboard →
          </Link>
        </Section>
      </div>
    </div>
  );
}

import Link from "next/link";

import { branding } from "@pl/config";
import { Button, Card, Section, StatusBadge } from "@pl/ui";

import { MarketCard } from "@/components/market-card";
import { NoLocalChain } from "@/components/no-local-chain";
import { WalletAssetsCard } from "@/components/wallet-assets-card";
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

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="space-y-4 py-10 text-center">
        <StatusBadge tone="indigo">Binary prediction markets on {branding.chainName}</StatusBadge>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
          Predict markets with the tokens you already hold
        </h1>
        <p className="mx-auto max-w-2xl text-slate-400">
          Pick a YES or NO market on an objective price outcome, fund it with supported ERC-20s like
          PONS or DELTA, and settle against Chainlink-backed oracles onchain.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link href="/markets">
            <Button size="lg">Browse markets</Button>
          </Link>
          <Link href="/assets">
            <Button size="lg" variant="secondary">
              Use my wallet assets
            </Button>
          </Link>
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

      <div className="grid gap-8 lg:grid-cols-2">
        <Section eyebrow="Analytics" title="Community pulse">
          <Card className="text-sm text-slate-400">
            Per-source-token community analytics (volume, YES/NO split, hit rate) appear once trades
            carry funding-token attribution.
          </Card>
        </Section>
        <Section eyebrow="Analytics" title="Top predictors">
          <Card className="text-sm text-slate-400">
            Wallet leaderboard by resolved-market performance is part of the community milestone.
          </Card>
        </Section>
      </div>
    </div>
  );
}

import Link from "next/link";

import { branding } from "@pl/config";
import { Button, Card, Section, StatusBadge } from "@pl/ui";

import { WalletAssetsCard } from "@/components/wallet-assets-card";

export default function HomePage() {
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

      <div className="grid gap-8 lg:grid-cols-2">
        <Section eyebrow="Live markets" title="Trending">
          <Card className="text-sm text-slate-400">
            No live markets indexed yet. Market feeds arrive with the indexer milestone — nothing is
            fabricated here.
          </Card>
        </Section>
        <Section eyebrow="Live markets" title="Closing soon">
          <Card className="text-sm text-slate-400">
            Markets ordered by remaining entry time will appear here once indexed.
          </Card>
        </Section>
      </div>

      <Section eyebrow="Robinhood Chain" title="Stock Token markets">
        <Card className="text-sm text-slate-400">
          Objective price markets on Stock Tokens (Chainlink-backed feeds, staleness and sequencer
          checks) are enabled by the oracle resolver.
        </Card>
      </Section>

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

      <Section eyebrow="History" title="Recently resolved">
        <Card className="text-sm text-slate-400">
          Resolved markets with their winning outcome and payout summary will list here.
        </Card>
      </Section>
    </div>
  );
}

import { notFound } from "next/navigation";
import { Badge, Card, Section, StatusBadge } from "@pl/ui";
import {
  AnalyticsUnavailable,
  formatBps,
  formatUsdg,
  MarketSplitRow,
  Stat,
  WalletTable,
} from "@/components/analytics";
import { getCommunity } from "@/lib/analytics-api";

export const dynamic = "force-dynamic";
const addressPattern = /^0x[a-fA-F0-9]{40}$/;

export default async function CommunityDetailPage({
  params,
}: {
  params: Promise<{ chainId: string; tokenAddress: string }>;
}) {
  const { chainId, tokenAddress } = await params;
  if (!/^\d+$/.test(chainId) || !addressPattern.test(tokenAddress)) notFound();
  let data: Awaited<ReturnType<typeof getCommunity>> | null = null;
  try {
    data = await getCommunity(chainId, tokenAddress, "all");
  } catch {}
  if (!data)
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Community analytics</h1>
        <AnalyticsUnavailable />
      </div>
    );
  const c = data.community;
  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="indigo">Verified source</StatusBadge>
          <Badge>Chain {c.chainId}</Badge>
        </div>
        <h1 className="text-3xl font-bold text-white">{c.symbol ?? "Token community"}</h1>
        <p className="text-slate-400">{c.name ?? c.tokenAddress}</p>
        <p className="break-all font-mono text-xs text-slate-600">{c.tokenAddress}</p>
      </header>
      <Section eyebrow="All time" title="Participant overview">
        <Card>
          <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Normalized volume" value={formatUsdg(c.volumeUsdg)} />
            <Stat label="Participating wallets" value={c.participantCount.toLocaleString()} />
            <Stat label="Resolved hit rate" value={formatBps(c.hitRateBps)} />
            <Stat label="Realized PnL" value={formatUsdg(c.realizedPnlUsdg)} />
          </dl>
        </Card>
      </Section>
      <Section eyebrow="Capital split" title="Markets most funded with this token">
        <div className="space-y-3">
          {c.markets.map((market) => (
            <MarketSplitRow key={`${market.chainId}:${market.address}`} market={market} />
          ))}
        </div>
      </Section>
      <Section eyebrow="Resolved performance" title="Top predictors">
        {c.topPredictors.length ? (
          <WalletTable entries={c.topPredictors} />
        ) : (
          <Card className="text-sm text-slate-400">No resolved participant positions yet.</Card>
        )}
      </Section>
      <Card className="text-xs text-slate-500">
        Hit rate uses each wallet’s net YES/NO capital stance per resolved market. Tied stances are
        neutral. Realized PnL mirrors the market payout formula over the verified source-funded
        portion.
      </Card>
    </div>
  );
}

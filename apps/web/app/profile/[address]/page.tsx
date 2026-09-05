import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Section, StatusBadge } from "@pl/ui";
import {
  AnalyticsUnavailable,
  formatBps,
  formatUsdg,
  shortAddress,
  Stat,
} from "@/components/analytics";
import { getProfile } from "@/lib/analytics-api";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) notFound();
  let data: Awaited<ReturnType<typeof getProfile>> | null = null;
  try {
    data = await getProfile(address);
  } catch {}
  if (!data)
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Predictor profile</h1>
        <AnalyticsUnavailable />
      </div>
    );
  const { profile } = data;
  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <StatusBadge tone="indigo">Public onchain activity</StatusBadge>
        <h1 className="font-mono text-3xl font-bold text-white">{shortAddress(profile.address)}</h1>
        <p className="break-all font-mono text-xs text-slate-500">{profile.address}</p>
      </header>
      <Section eyebrow="Verified source-funded entries" title="All-time performance">
        <Card>
          <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Volume" value={formatUsdg(profile.stats.volumeUsdg)} />
            <Stat label="Realized PnL" value={formatUsdg(profile.stats.realizedPnlUsdg)} />
            <Stat label="ROI" value={formatBps(profile.stats.roiBps)} />
            <Stat label="Hit rate" value={formatBps(profile.stats.hitRateBps)} />
            <Stat label="Resolved markets" value={profile.stats.resolvedMarkets.toString()} />
          </dl>
        </Card>
      </Section>
      <Section eyebrow="Funding attribution" title="Source-token breakdown">
        <div className="grid gap-3 md:grid-cols-2">
          {profile.communities.map((community) => (
            <Link
              key={`${community.chainId}:${community.tokenAddress}`}
              href={`/community/${community.chainId}/${community.tokenAddress}`}
            >
              <Card className="transition-colors hover:border-indigo-400/40">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">
                      {community.symbol ?? shortAddress(community.tokenAddress)}
                    </p>
                    <p className="text-xs text-slate-500">{community.marketCount} markets</p>
                  </div>
                  <p className="text-sm text-slate-300">{formatUsdg(community.volumeUsdg)}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </Section>
      <Section eyebrow="History" title="Recent resolved predictions">
        <div className="space-y-3">
          {profile.recentPredictions.map((prediction, index) => (
            <Card
              key={`${prediction.marketAddress}:${prediction.fundingToken.address}:${index}`}
              className="flex flex-wrap items-center justify-between gap-4"
            >
              <div>
                <Link
                  href={`/market/${prediction.marketSlug}`}
                  className="font-medium text-white hover:text-indigo-300"
                >
                  {prediction.question}
                </Link>
                <p className="mt-1 text-xs text-slate-500">
                  Funded with{" "}
                  {prediction.fundingToken.symbol ?? shortAddress(prediction.fundingToken.address)}{" "}
                  · {new Date(prediction.resolvedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <Badge
                  className={
                    prediction.result === "WIN"
                      ? "text-emerald-300"
                      : prediction.result === "LOSS"
                        ? "text-rose-300"
                        : ""
                  }
                >
                  {prediction.result}
                </Badge>
                <p className="mt-1 text-sm text-slate-300">
                  {formatUsdg(prediction.realizedPnlUsdg)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}

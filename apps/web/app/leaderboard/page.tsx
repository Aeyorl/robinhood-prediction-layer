import Link from "next/link";
import { Card, StatusBadge } from "@pl/ui";
import { AnalyticsUnavailable, WalletTable } from "@/components/analytics";
import { getLeaderboard } from "@/lib/analytics-api";

export const dynamic = "force-dynamic";
const metrics = ["pnl", "roi", "hit_rate", "volume"] as const;
const windows = ["7d", "30d", "all"] as const;

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string; window?: string }>;
}) {
  const query = await searchParams;
  const metric = metrics.find((value) => value === query.metric) ?? "pnl";
  const window = windows.find((value) => value === query.window) ?? "all";
  let data: Awaited<ReturnType<typeof getLeaderboard>> | null = null;
  try {
    data = await getLeaderboard(metric, window);
  } catch {}
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <StatusBadge tone="indigo">Verified source-funded entries</StatusBadge>
        <h1 className="text-3xl font-bold text-white">Predictor leaderboard</h1>
        <p className="max-w-3xl text-slate-400">
          Rank participating wallets by reproducible resolved-market performance.
        </p>
      </header>
      <div className="flex flex-wrap gap-2">
        {metrics.map((item) => (
          <Link
            key={item}
            href={`/leaderboard?metric=${item}&window=${window}`}
            className={`rounded-lg px-3 py-2 text-sm ${item === metric ? "bg-indigo-600 text-white" : "bg-white/5 text-slate-300"}`}
          >
            {item.replace("_", " ")}
          </Link>
        ))}
        <span className="mx-1 border-l border-white/10" />
        {windows.map((item) => (
          <Link
            key={item}
            href={`/leaderboard?metric=${metric}&window=${item}`}
            className={`rounded-lg px-3 py-2 text-sm ${item === window ? "bg-white/15 text-white" : "bg-white/5 text-slate-400"}`}
          >
            {item === "all" ? "All time" : item.toUpperCase()}
          </Link>
        ))}
      </div>
      {!data ? (
        <AnalyticsUnavailable />
      ) : data.entries.length === 0 ? (
        <Card className="space-y-2 text-sm text-slate-400">
          <p>No wallets qualify for this ranking yet.</p>
          <Link
            href="/markets"
            className="inline-flex font-semibold text-indigo-300 hover:text-indigo-200"
          >
            Make a prediction →
          </Link>
        </Card>
      ) : (
        <WalletTable entries={data.entries} />
      )}
      {(metric === "roi" || metric === "hit_rate") && (
        <p className="text-xs text-slate-500">
          Minimum {data?.minimumResolvedMarkets ?? 3} resolved markets required for this ranking.
        </p>
      )}
    </div>
  );
}

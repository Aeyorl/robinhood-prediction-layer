import Link from "next/link";
import { LeaderboardBoard } from "@/components/analytics";
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
    <div className="light-route leaderboard-route">
      <div className="leaderboard-heading">
        <header>
          <span className="section-kicker">Verified source-funded entries</span>
          <h1 className="block-heading">Top predictors</h1>
          <p>Reproducible resolved-market performance.</p>
        </header>
        <div className="leaderboard-controls">
          <div>
            {metrics.map((item) => (
              <Link
                key={item}
                href={`/leaderboard?metric=${item}&window=${window}`}
                className={item === metric ? "active" : ""}
              >
                {item.replace("_", " ")}
              </Link>
            ))}
          </div>
          <div>
            {windows.map((item) => (
              <Link
                key={item}
                href={`/leaderboard?metric=${metric}&window=${item}`}
                className={item === window ? "active" : ""}
              >
                {item === "all" ? "All time" : item.toUpperCase()}
              </Link>
            ))}
          </div>
        </div>
      </div>
      {!data ? (
        <>
          <LeaderboardBoard entries={[]} />
          <div className="leaderboard-empty leaderboard-empty-overlay">
            Leaderboard data is unavailable while the indexer API is offline.
          </div>
        </>
      ) : data.entries.length === 0 ? (
        <>
          <LeaderboardBoard entries={[]} />
          <div className="leaderboard-empty leaderboard-empty-overlay">
            <p>No wallets qualify for this ranking yet.</p>
            <Link href="/markets">Make a prediction →</Link>
          </div>
        </>
      ) : (
        <LeaderboardBoard entries={data.entries} />
      )}
      {(metric === "roi" || metric === "hit_rate") && (
        <p className="leaderboard-method-note">
          Minimum {data?.minimumResolvedMarkets ?? 3} resolved markets required for this ranking.
        </p>
      )}
      <div className="leaderboard-footer-row">
        <span>
          ROI and hit-rate rankings require at least {data?.minimumResolvedMarkets ?? 3} resolved
          markets.
        </span>
        <Link href="/docs">View methodology →</Link>
        <span>Window: {window === "all" ? "All time" : window.toUpperCase()}</span>
      </div>
    </div>
  );
}

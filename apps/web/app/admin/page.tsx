import { Badge, Card, StatusBadge } from "@pl/ui";

import { loadOracleAdminData } from "@/lib/server/oracle-health";

export const dynamic = "force-dynamic";

function compactAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatAge(seconds: number | null) {
  if (seconds == null) return "Unknown";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3_600)}h ${Math.floor((seconds % 3_600) / 60)}m`;
}

function shortEnum(value: string) {
  return value.replace("CORPORATE_ACTION_TYPE_", "").replaceAll("_", " ");
}

export default async function AdminPage() {
  const data = await loadOracleAdminData();
  const healthyCount = data.rows.filter((row) => row.healthy).length;
  const pendingMultipliers = data.rows.filter((row) => row.pendingMultiplier);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Badge>Phase 5 oracle gate</Badge>
        <h1 className="text-2xl font-bold text-white">Oracle health</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Live Chainlink rounds and Robinhood Stock Token pause state for the curated launch assets.
          Create or resolve markets only while every required check is healthy.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-wider text-slate-500">Healthy feeds</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {healthyCount}/{data.rows.length}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider text-slate-500">Corporate actions</p>
          <p className="mt-2 text-2xl font-semibold text-white">{data.warnings.length}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider text-slate-500">Pending multipliers</p>
          <p className="mt-2 text-2xl font-semibold text-white">{pendingMultipliers.length}</p>
        </Card>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Curated Stock Token feeds</h2>
          <p className="text-xs text-slate-500">
            Heartbeat: 24 hours. Closed-session feeds can become stale and must not resolve a
            market.
          </p>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Round age</th>
                <th className="px-4 py-3">Oracle pause</th>
                <th className="px-4 py-3">Multiplier</th>
                <th className="px-4 py-3">Contracts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {data.rows.map((row) => (
                <tr key={row.symbol} className="text-slate-300">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-white">{row.symbol}</p>
                    <p className="text-xs text-slate-500">{row.name}</p>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge tone={row.healthy ? "green" : "red"}>{row.status}</StatusBadge>
                  </td>
                  <td className="px-4 py-4 font-mono">{row.price ?? "Unavailable"}</td>
                  <td className="px-4 py-4">{formatAge(row.ageSeconds)}</td>
                  <td className="px-4 py-4">
                    {row.oraclePaused == null ? "Unreadable" : row.oraclePaused ? "Paused" : "Open"}
                  </td>
                  <td className="px-4 py-4 font-mono text-xs">
                    {row.currentMultiplier ?? "Unavailable"}
                    {row.pendingMultiplier ? (
                      <p className="mt-1 text-amber-300">Pending {row.pendingMultiplier}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-500">
                    <p title={row.token}>Token {compactAddress(row.token)}</p>
                    <p title={row.feed}>Feed {compactAddress(row.feed)}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-amber-300">
          No official Robinhood Chain sequencer uptime feed is published in Chainlink&apos;s current
          reference directory. The resolver supports one, but production configuration remains empty
          until an official address is available.
        </p>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Corporate-action warnings</h2>
          <p className="text-xs text-slate-500">
            Robinhood&apos;s read-only action feed for AAPL, NVDA, and TSLA.
          </p>
        </div>
        {!data.actionsAvailable ? (
          <Card className="border-amber-500/30 text-sm text-amber-200">
            The corporate-action feed is temporarily unavailable. Treat asset health as unverified.
          </Card>
        ) : data.warnings.length === 0 ? (
          <Card className="text-sm text-slate-400">
            No recent corporate actions were returned for the curated assets.
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.warnings.map((action) => (
              <Card key={action.id} className="border-amber-500/20">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-white">{action.tokenSymbol}</p>
                  <StatusBadge tone="amber">
                    {action.status.replace("CORPORATE_ACTION_STATUS_", "")}
                  </StatusBadge>
                </div>
                <p className="mt-2 text-sm text-slate-300">{shortEnum(action.type)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {action.processDate
                    ? `${action.processDate.year}-${String(action.processDate.month).padStart(2, "0")}-${String(action.processDate.day).padStart(2, "0")}`
                    : "Process date unavailable"}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

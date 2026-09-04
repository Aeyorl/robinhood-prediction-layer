import Link from "next/link";

import { branding } from "@pl/config";
import { StatusBadge } from "@pl/ui";

import { MarketCard } from "@/components/market-card";
import { NoLocalChain } from "@/components/no-local-chain";
import { MARKET_STATUS, type MarketStatus } from "@/lib/market-view";
import { loadMarketViews } from "@/lib/server/markets";

export const dynamic = "force-dynamic";

const TABS: Array<{ key: string; label: string }> = [
  { key: "ALL", label: "All" },
  ...MARKET_STATUS.map((s) => ({ key: s, label: s })),
];

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const requested = (TABS.some((t) => t.key === status) ? status : "ALL") as
    | "ALL"
    | MarketStatus;

  let views: Awaited<ReturnType<typeof loadMarketViews>>["views"] | null = null;
  let chainDown = false;
  try {
    views = (await loadMarketViews()).views;
  } catch {
    chainDown = true;
  }

  const filtered = views
    ? views.filter((v) => requested === "ALL" || v.status === requested)
    : [];

  // OPEN/LOCKED first (soonest entry close), then resolved (most recent first).
  const sorted = [...filtered].sort((a, b) => {
    if (a.status === "RESOLVED" || a.status === "CANCELLED") {
      if (b.status === "RESOLVED" || b.status === "CANCELLED") return (b.resolvedAt ?? b.resolutionTime) - (a.resolvedAt ?? a.resolutionTime);
      return 1;
    }
    if (b.status === "RESOLVED" || b.status === "CANCELLED") return -1;
    return a.lockTime - b.lockTime;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Markets</h1>
        <p className="text-sm text-slate-400">
          Binary markets on objective outcomes, read live from the {branding.chainName} chain.
          {chainDown && " The local chain is unreachable — see the note below."}
        </p>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => {
          const active = requested === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.key === "ALL" ? "/markets" : `/markets?status=${tab.key}`}
              className={
                active
                  ? "rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-200 ring-1 ring-indigo-400/40"
                  : "rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300 ring-1 ring-white/10 hover:bg-white/10"
              }
            >
              {tab.label}
            </Link>
          );
        })}
        {views != null && (
          <span className="ml-2 self-center text-xs text-slate-500">
            {filtered.length} market{filtered.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {views == null || chainDown ? (
        <NoLocalChain />
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
          No markets in this state. Check back later or run a new deployment to create markets.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((m) => (
            <MarketCard key={m.address} market={m} />
          ))}
        </div>
      )}

      {views != null && views.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <StatusBadge tone="green">Live</StatusBadge>
          Pools and statuses are read directly from the chain on every request.
        </p>
      )}
    </div>
  );
}

import { branding } from "@pl/config";
import { StatusBadge } from "@pl/ui";

import { MarketDirectory } from "@/components/market-directory";
import { NoLocalChain } from "@/components/no-local-chain";
import { MARKET_STATUS, type MarketStatus } from "@/lib/market-view";
import { loadMarketViews } from "@/lib/server/markets";

export const dynamic = "force-dynamic";

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const requested = (MARKET_STATUS.some((item) => item === status) ? status : "ALL") as
    "ALL" | MarketStatus;

  let views: Awaited<ReturnType<typeof loadMarketViews>>["views"] | null = null;
  let chainDown = false;
  try {
    views = (await loadMarketViews()).views;
  } catch {
    chainDown = true;
  }

  return (
    <div className="space-y-8">
      <div className="max-w-3xl space-y-3">
        <StatusBadge tone="indigo">Live market directory</StatusBadge>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Explore markets
        </h1>
        <p className="text-slate-400">
          Find objective YES or NO outcomes settled on {branding.chainName}.
          {chainDown && " The local chain is unreachable — see the note below."}
        </p>
      </div>

      {views == null || chainDown ? (
        <NoLocalChain />
      ) : views.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
          No markets are available yet. Check back after the next market opens.
        </div>
      ) : (
        <MarketDirectory markets={views} initialStatus={requested} />
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

import { MarketDirectory } from "@/components/market-directory";
import { NoLocalChain } from "@/components/no-local-chain";
import { MARKET_STATUS, type MarketStatus } from "@/lib/market-view";
import { loadMarketViews } from "@/lib/server/markets";

export const dynamic = "force-dynamic";

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
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
    <div className="light-route market-signals-route">
      {views == null || chainDown ? (
        <div className="route-empty-shell">
          <span className="section-kicker">Live market directory</span>
          <h1 className="block-heading">Market signals</h1>
          <NoLocalChain />
        </div>
      ) : views.length === 0 ? (
        <div className="route-empty-shell">
          <span className="section-kicker">Live market directory</span>
          <h1 className="block-heading">Market signals</h1>
          <div className="route-empty-message">
            No markets are available yet. Check back after the next market opens.
          </div>
        </div>
      ) : (
        <MarketDirectory markets={views} initialStatus={requested} initialQuery={q ?? ""} />
      )}
    </div>
  );
}

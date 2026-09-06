import { PortfolioList } from "@/components/portfolio-list";
import { NoLocalChain } from "@/components/no-local-chain";
import { loadMarketViews } from "@/lib/server/markets";
import { StatusBadge } from "@pl/ui";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  let views: Awaited<ReturnType<typeof loadMarketViews>>["views"] | null = null;
  try {
    views = (await loadMarketViews()).views;
  } catch {
    views = null;
  }

  return (
    <div className="space-y-8">
      <div className="max-w-3xl space-y-3">
        <StatusBadge tone="indigo">Connected wallet positions</StatusBadge>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Portfolio</h1>
        <p className="text-slate-400">
          Your positions across markets — stake, pool share, and claim/refund state read directly
          from the chain for your connected wallet.
        </p>
      </div>

      {views == null ? <NoLocalChain /> : <PortfolioList markets={views} />}
    </div>
  );
}

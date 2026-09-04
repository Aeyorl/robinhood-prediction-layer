import { PortfolioList } from "@/components/portfolio-list";
import { NoLocalChain } from "@/components/no-local-chain";
import { loadMarketViews } from "@/lib/server/markets";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  let views: Awaited<ReturnType<typeof loadMarketViews>>["views"] | null = null;
  try {
    views = (await loadMarketViews()).views;
  } catch {
    views = null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Portfolio</h1>
        <p className="text-sm text-slate-400">
          Your positions across markets — stake, pool share, and claim/refund state read directly
          from the chain for your connected wallet.
        </p>
      </div>

      {views == null ? <NoLocalChain /> : <PortfolioList markets={views} />}
    </div>
  );
}

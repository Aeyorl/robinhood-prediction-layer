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
    <div className="light-route portfolio-route">
      <header className="portfolio-heading">
        <span className="section-kicker">Connected wallet positions</span>
        <h1 className="block-heading">Your portfolio</h1>
        <p>Stake, pool share, and claim or refund state read directly from the chain.</p>
      </header>
      {views == null ? <NoLocalChain /> : <PortfolioList markets={views} />}
    </div>
  );
}

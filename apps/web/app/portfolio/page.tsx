import { PortfolioPreview } from "@/components/portfolio-preview";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  return (
    <div className="light-route portfolio-route">
      <header className="portfolio-heading">
        <span className="section-kicker">Portfolio preview</span>
        <h1 className="block-heading">Your portfolio</h1>
        <p>Preview how positions, exposure, claim state, and history will appear after launch.</p>
      </header>
      <PortfolioPreview />
    </div>
  );
}

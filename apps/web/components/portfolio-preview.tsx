import Link from "next/link";

export function PortfolioPreview() {
  return (
    <section className="portfolio-ledger demo-surface">
      <div className="demo-banner">No wallet portfolio data is available yet.</div>
      <div className="atlas-ledger-empty">
        <span className="section-kicker">Read-only portfolio</span>
        <h2>Nothing to show yet</h2>
        <p>
          Positions, exposure, claims, and history will appear after verified markets are deployed
          and trading opens.
        </p>
        <Link href="/markets">Explore live asset discovery →</Link>
      </div>
    </section>
  );
}

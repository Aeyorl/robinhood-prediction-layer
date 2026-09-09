import Link from "next/link";
import { notFound } from "next/navigation";

import { loadPublicMarkets } from "@/lib/server/dexscreener";

export default async function MarketDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { markets } = await loadPublicMarkets();
  const market = markets.find((item) => item.slug === slug);
  if (!market) notFound();

  return (
    <div className="read-only-route">
      <div className="sample-detail">
        <Link href="/markets" className="sample-back">
          ← All markets
        </Link>
        <div className="sample-preview-banner">
          <strong>Preview market</strong>
          <span>Market discovery is live. Trading is not open.</span>
        </div>
        <header className="sample-detail-header">
          <div>
            <span className={`sample-category sample-category-${market.category.toLowerCase()}`}>
              {market.category === "MEMECOINS" ? "Memecoin" : "Stock"}
            </span>
            <div className="sample-asset-line">
              <strong>{market.symbol}</strong>
              <span>{market.assetName}</span>
            </div>
            <h1>{market.question}</h1>
            <p>
              {market.closeLabel} · {market.status.replace("_", " ")} · {market.volume} sample
              volume
            </p>
          </div>
          <div
            className="sample-detail-split"
            aria-label={`YES ${market.yesShare}% capital share, NO ${market.noShare}% capital share`}
          >
            <div className="sample-share sample-yes">
              <span>▲ YES</span>
              <strong>{market.yesShare}%</strong>
              <small>capital share</small>
            </div>
            <div className="sample-share sample-no">
              <span>○ NO</span>
              <strong>{market.noShare}%</strong>
              <small>capital share</small>
            </div>
          </div>
        </header>

        <div className="sample-detail-grid">
          <section className="sample-detail-content">
            <article className="sample-information-card">
              <span>Market terms</span>
              <p>{market.terms}</p>
            </article>
            {market.sourceUrl && (
              <article className="sample-information-card">
                <span>Discovery source</span>
                <h2>{market.sourceLabel}</h2>
                <p>
                  {market.marketCapLabel} · {market.liquidityLabel}
                </p>
                <a
                  href={market.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="sample-source-link"
                >
                  View the source pair →
                </a>
              </article>
            )}
            <article className="sample-information-card">
              <span>Resolution source</span>
              <h2>{market.oracle}</h2>
              <p>
                {market.resolutionMethod}. Evidence status: {market.evidenceStatus}.
              </p>
            </article>
            <article className="sample-information-card">
              <span>How resolution works</span>
              <ol>
                <li>The stated source and close time define the observation window.</li>
                <li>Evidence is reviewed against the published market terms.</li>
                <li>
                  A future deployed market may resolve onchain only after its evidence requirements
                  are met.
                </li>
              </ol>
            </article>
            <article className="sample-information-card">
              <span>Activity</span>
              <p>
                Sample activity is intentionally unavailable. No wallet positions, deposits, or
                transactions have been created for this preview.
              </p>
            </article>
          </section>
          <aside className="sample-disabled-trade" aria-label="Trading unavailable">
            <span className="sample-kicker">Transaction panel</span>
            <h2>Trading not open yet</h2>
            <p>
              Trading opens after onchain deployment and final launch checks. This preview does not
              connect wallets, request approvals, construct transactions, or accept deposits.
            </p>
            <div className="sample-disabled-options">
              <div>
                <span>▲ YES</span>
                <strong>{market.yesShare}% capital share</strong>
              </div>
              <div>
                <span>○ NO</span>
                <strong>{market.noShare}% capital share</strong>
              </div>
            </div>
            <button type="button" disabled>
              Trading not open yet
            </button>
            <small>Capital share is not guaranteed probability.</small>
          </aside>
        </div>
        <p className="sample-detail-disclaimer">
          Independent product. Not affiliated with or endorsed by Robinhood. All displayed market
          and volume figures are demonstration data until deployed markets exist.
        </p>
      </div>
    </div>
  );
}

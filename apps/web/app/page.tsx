import Link from "next/link";

import { SampleMarketCard } from "@/components/sample-market-directory";
import { loadPublicMarkets } from "@/lib/server/dexscreener";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { markets: sampleMarkets } = await loadPublicMarkets();
  const featured = sampleMarkets[0];
  if (!featured) return null;
  return (
    <div className="read-only-route">
      <section className="sample-home-hero">
        <div>
          <span className="sample-kicker">Public preview · Robinhood Chain</span>
          <h1>
            Read the market.
            <br />
            Before it opens.
          </h1>
          <p>
            Explore stock and memecoin market designs, terms, and resolution methods. This is a
            read-only product preview.
          </p>
          <div>
            <Link href="/markets" className="sample-primary-link">
              Explore markets →
            </Link>
            <a href="#how-it-works" className="sample-secondary-link">
              How it works ↓
            </a>
          </div>
        </div>
        <div className="sample-home-signal">
          <span>YES</span>
          <strong>{featured.yesShare}%</strong>
          <i />
          <span>NO</span>
          <strong>{featured.noShare}%</strong>
          <small>
            capital share
            <br />
            not guaranteed probability
          </small>
        </div>
      </section>
      <section className="sample-home-section">
        <div className="sample-home-section-heading">
          <div>
            <span className="sample-kicker">Markets</span>
            <h2>Stocks and memecoins</h2>
          </div>
          <Link href="/markets">See all {sampleMarkets.length} →</Link>
        </div>
        <div className="sample-market-grid">
          {sampleMarkets.slice(0, 6).map((market) => (
            <SampleMarketCard key={market.slug} market={market} />
          ))}
        </div>
      </section>
      <section id="how-it-works" className="sample-how-it-works">
        <div>
          <span>01</span>
          <h2>Explore the terms</h2>
          <p>Each market preview describes the question, close time, and evidence path.</p>
        </div>
        <div>
          <span>02</span>
          <h2>Read capital share</h2>
          <p>
            YES and NO figures show illustrative capital share. They are not guaranteed
            probabilities.
          </p>
        </div>
        <div>
          <span>03</span>
          <h2>Wait for launch checks</h2>
          <p>
            Trading stays unavailable until onchain deployment and final launch checks are complete.
          </p>
        </div>
      </section>
      <p className="sample-detail-disclaimer">
        Market discovery is live. Independent product. Not affiliated with or endorsed by Robinhood.
      </p>
    </div>
  );
}

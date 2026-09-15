import Link from "next/link";

import { LightSampleMarketCard } from "@/components/sample-market-directory";
import { TwoSidedHero } from "@/components/two-sided-hero";
import { loadPublicMarkets } from "@/lib/server/dexscreener";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { markets, memeDiscovery } = await loadPublicMarkets();
  const featured = markets[0] ?? null;
  const cards = markets.slice(0, 3);

  return (
    <div className="home-shell light-home">
      <TwoSidedHero market={featured} />

      <section className="live-market-section" aria-labelledby="live-markets-title">
        <div className="live-heading">
          <h2 id="live-markets-title">
            Explore the atlas{" "}
            <span>
              <i />
              {markets.length} previews
            </span>
          </h2>
          <Link href="/markets">
            View all markets <b aria-hidden="true">→</b>
          </Link>
        </div>
        <nav className="home-market-categories" aria-label="Market categories">
          <Link href="/markets" className="active">
            Stocks
          </Link>
          <Link href="/markets?category=MEMECOINS">Memecoins</Link>
          <Link href="/markets?q=earnings">Earnings</Link>
          <Link href="/markets?q=price">Price targets</Link>
        </nav>
        {cards.length ? (
          <div className="atlas-market-stage">
            <div className="light-market-grid">
              {cards.map((market) => (
                <LightSampleMarketCard key={market.slug} market={market} />
              ))}
            </div>
          </div>
        ) : (
          <div className="light-empty-market">Verified market data is not available yet.</div>
        )}
      </section>

      {memeDiscovery.status === "unavailable" ? (
        <div className="light-empty-market homepage-feed-note">{memeDiscovery.message}</div>
      ) : null}

      <section className="trust-row" aria-label="Product foundations">
        <div>
          <span className="trust-number">01</span>
          <p>
            <strong>Built on Robinhood Chain</strong>
            <small>Independent product preview.</small>
          </p>
        </div>
        <div>
          <span className="trust-number">02</span>
          <p>
            <strong>Resolution clarity</strong>
            <small>Terms and evidence methods are shown.</small>
          </p>
        </div>
        <div>
          <span className="trust-number">03</span>
          <p>
            <strong>Read-only discovery</strong>
            <small>No deposits or approvals are requested.</small>
          </p>
        </div>
        <div>
          <span className="trust-number">04</span>
          <p>
            <strong>Trading not open</strong>
            <small>Launch checks must finish first.</small>
          </p>
        </div>
      </section>

      <section className="light-explainer" id="how-it-works">
        <div>
          <span>01</span>
          <h2>Choose a market.</h2>
          <p>Read the question, close time, and source method.</p>
        </div>
        <div>
          <span>02</span>
          <h2>Compare both sides.</h2>
          <p>Capital share is illustrative and not guaranteed probability.</p>
        </div>
        <div>
          <span>03</span>
          <h2>Review the terms.</h2>
          <p>Trading opens only after onchain deployment and final launch checks.</p>
        </div>
        <Link href="/docs" className="black-action">
          Read the user guide →
        </Link>
      </section>
    </div>
  );
}

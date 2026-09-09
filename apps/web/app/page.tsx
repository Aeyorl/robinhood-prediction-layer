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
            Discovery markets{" "}
            <span>
              <i />
              {markets.length} previews
            </span>
          </h2>
          <Link href="/markets">
            View all markets <b aria-hidden="true">→</b>
          </Link>
        </div>
        {cards.length ? (
          <div className="light-market-grid">
            {cards.map((market) => (
              <LightSampleMarketCard key={market.slug} market={market} />
            ))}
          </div>
        ) : (
          <div className="light-empty-market">Market previews are temporarily unavailable.</div>
        )}
      </section>

      {cards.length ? (
        <div className="activity-tape" aria-label="Sample market signals">
          <span className="tape-live">
            Sample signals <i />
          </span>
          {cards.concat(cards.slice(0, 1)).map((market, index) => (
            <Link key={`${market.slug}-${index}`} href={`/market/${market.slug}`}>
              <b>{market.symbol}</b>
              <span>{market.status.replace("_", " ")}</span>
              <span className="yes-copy">▲ YES {market.yesShare}%</span>
              <span className="no-copy">○ NO {market.noShare}%</span>
            </Link>
          ))}
          <Link href="/markets" className="tape-view">
            View all →
          </Link>
        </div>
      ) : null}

      {memeDiscovery.status === "unavailable" ? (
        <div className="light-empty-market homepage-feed-note">
          Robinhood Chain memecoin discovery is temporarily unavailable. Stock previews remain
          visible.
        </div>
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

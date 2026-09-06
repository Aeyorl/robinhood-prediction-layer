import Link from "next/link";

import { MarketCard } from "@/components/market-card";
import { NoLocalChain } from "@/components/no-local-chain";
import { TwoSidedHero } from "@/components/two-sided-hero";
import type { MarketView } from "@/lib/market-view";
import { loadMarketViews } from "@/lib/server/markets";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let views: MarketView[] | null = null;
  let chainDown = false;
  try {
    views = (await loadMarketViews()).views;
  } catch {
    chainDown = true;
  }

  const ranked = views
    ? [...views]
        .filter((market) => market.status !== "CANCELLED")
        .sort((a, b) => Number(BigInt(b.totalPool) - BigInt(a.totalPool)))
    : [];
  const live = ranked.filter((market) => market.status === "OPEN");
  const featured = live[0] ?? ranked[0] ?? null;
  const cards = (live.length > 0 ? live : ranked).slice(0, 3);

  return (
    <div className="home-shell light-home">
      <TwoSidedHero market={featured} />

      <section className="live-market-section" aria-labelledby="live-markets-title">
        <div className="live-heading">
          <h2 id="live-markets-title">
            Live markets{" "}
            <span>
              <i />
              {live.length}
            </span>
          </h2>
          <Link href="/markets">
            View all markets <b aria-hidden="true">→</b>
          </Link>
        </div>
        {chainDown || views == null ? (
          <div className="light-chain-note">
            <NoLocalChain />
          </div>
        ) : cards.length === 0 ? (
          <div className="light-empty-market">
            The configured chain is reachable, but no markets are open yet.
          </div>
        ) : (
          <div className="light-market-grid">
            {cards.map((market) => (
              <MarketCard key={market.address} market={market} />
            ))}
          </div>
        )}
      </section>

      {cards.length > 0 ? (
        <div className="activity-tape" aria-label="Live market state">
          <span className="tape-live">
            Live state <i />
          </span>
          {cards.concat(cards.slice(0, 1)).map((market, index) => (
            <Link key={`${market.address}-${index}`} href={`/market/${market.slug}`}>
              <b>{market.assetSymbol}</b>
              <span>{market.status}</span>
              <span className="yes-copy">
                YES {market.yesSharePct == null ? "—" : `${market.yesSharePct.toFixed(0)}%`}
              </span>
              <span className="no-copy">
                NO {market.noSharePct == null ? "—" : `${market.noSharePct.toFixed(0)}%`}
              </span>
            </Link>
          ))}
          <Link href="/markets" className="tape-view">
            View all →
          </Link>
        </div>
      ) : null}

      <section className="trust-row" aria-label="Product foundations">
        <div>
          <span className="trust-number">01</span>
          <p>
            <strong>Built on Robinhood Chain</strong>
            <small>EVM-compatible. Wallet-native.</small>
          </p>
        </div>
        <div>
          <span className="trust-number">02</span>
          <p>
            <strong>Oracle safeguards</strong>
            <small>Feed, staleness and sequencer checks.</small>
          </p>
        </div>
        <div>
          <span className="trust-number">03</span>
          <p>
            <strong>Non-custodial</strong>
            <small>You keep control of your funds.</small>
          </p>
        </div>
        <div>
          <span className="trust-number">04</span>
          <p>
            <strong>Transparent contracts</strong>
            <small>Addresses and behavior are documented.</small>
          </p>
        </div>
      </section>

      <section className="light-explainer" id="how-it-works">
        <div>
          <span>01</span>
          <h2>Choose a market.</h2>
          <p>Read the outcome terms, close time and oracle method.</p>
        </div>
        <div>
          <span>02</span>
          <h2>Take a side.</h2>
          <p>Choose YES or NO and review the current capital share.</p>
        </div>
        <div>
          <span>03</span>
          <h2>Review and sign.</h2>
          <p>Check funding, slippage and every wallet transaction.</p>
        </div>
        <Link href="/docs" className="black-action">
          Read the user guide →
        </Link>
      </section>
    </div>
  );
}

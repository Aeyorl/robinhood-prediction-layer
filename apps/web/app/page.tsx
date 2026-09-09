import Link from "next/link";

import { MarketCard } from "@/components/market-card";
import { NoLocalChain } from "@/components/no-local-chain";
import { TwoSidedHero } from "@/components/two-sided-hero";
import { formatUsdg, shortAddress } from "@/components/analytics";
import type { MarketView } from "@/lib/market-view";
import { groupedAmount } from "@/lib/market-view";
import { loadMarketViews } from "@/lib/server/markets";
import { getCommunities, getLeaderboard } from "@/lib/analytics-api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let views: MarketView[] | null = null;
  let chainDown = false;
  try {
    views = (await loadMarketViews()).views;
  } catch {
    chainDown = true;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const ranked = views
    ? [...views]
        .filter((market) => market.status !== "CANCELLED")
        .sort((a, b) => Number(BigInt(b.totalPool) - BigInt(a.totalPool)))
    : [];
  const live = ranked.filter((market) => market.status === "OPEN");
  const featured = live[0] ?? ranked[0] ?? null;
  const cards = (live.length > 0 ? live : ranked).slice(0, 3);

  /* Closing soon: open markets sorted by nearest lock time */
  const closingSoon = live
    .filter((market) => market.lockTime > nowSeconds)
    .sort((a, b) => a.lockTime - b.lockTime)
    .slice(0, 3);

  /* Recently resolved */
  const resolved = ranked
    .filter((market) => market.status === "RESOLVED")
    .sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0))
    .slice(0, 3);

  /* Analytics data — fail silently */
  let topCommunities: Awaited<ReturnType<typeof getCommunities>>["communities"] | null = null;
  let topPredictors: Awaited<ReturnType<typeof getLeaderboard>>["entries"] | null = null;
  try {
    topCommunities = (await getCommunities("7d")).communities.slice(0, 3);
  } catch {}
  try {
    topPredictors = (await getLeaderboard("pnl", "all")).entries.slice(0, 5);
  } catch {}

  return (
    <div className="home-shell light-home">
      <TwoSidedHero market={featured} />

      {/* §3.1 — Trending / Live markets */}
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

      {/* §3.2 — Closing soon */}
      {closingSoon.length > 0 && (
        <section className="home-section" aria-labelledby="closing-soon-title">
          <div className="home-section-heading">
            <h2 id="closing-soon-title">
              Closing soon <span className="home-section-count">{closingSoon.length}</span>
            </h2>
            <Link href="/markets?status=OPEN">View all open →</Link>
          </div>
          <div className="light-market-grid">
            {closingSoon.map((market) => (
              <MarketCard key={market.address} market={market} />
            ))}
          </div>
        </section>
      )}

      {/* Activity tape */}
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

      {/* §3.5 — Community pulse */}
      {topCommunities && topCommunities.length > 0 && (
        <section className="home-section" aria-labelledby="community-pulse-title">
          <div className="home-section-heading">
            <h2 id="community-pulse-title">Community pulse</h2>
            <Link href="/communities">Explore communities →</Link>
          </div>
          <div className="home-community-grid">
            {topCommunities.map((community) => (
              <Link
                key={`${community.chainId}:${community.tokenAddress}`}
                href={`/community/${community.chainId}/${community.tokenAddress}`}
                className="home-community-card"
              >
                <span className="home-community-symbol">
                  {community.symbol ?? shortAddress(community.tokenAddress)}
                </span>
                <span className="home-community-volume">
                  {formatUsdg(community.volumeUsdg)} prediction volume
                </span>
                <span className="home-community-meta">
                  {community.participantCount.toLocaleString()} wallets · {community.marketCount}{" "}
                  markets
                </span>
                {community.topCurrentStance && (
                  <span className="home-community-stance">
                    {community.topCurrentStance.question.length > 55
                      ? `${community.topCurrentStance.question.slice(0, 52)}…`
                      : community.topCurrentStance.question}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* §3.6 — Top predictors */}
      {topPredictors && topPredictors.length > 0 && (
        <section className="home-section" aria-labelledby="top-predictors-title">
          <div className="home-section-heading">
            <h2 id="top-predictors-title">Top predictors</h2>
            <Link href="/leaderboard">Full leaderboard →</Link>
          </div>
          <div className="home-predictors-list">
            {topPredictors.map((predictor, index) => (
              <Link
                key={predictor.address}
                href={`/profile/${predictor.address}`}
                className="home-predictor-row"
              >
                <span className="home-predictor-rank">{index + 1}</span>
                <span className="home-predictor-address">{shortAddress(predictor.address)}</span>
                <span className="home-predictor-pnl">
                  {formatUsdg(predictor.realizedPnlUsdg)} PnL
                </span>
                <span className="home-predictor-wins">
                  {predictor.wins}W / {predictor.losses}L
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* §3.7 — Recently resolved */}
      {resolved.length > 0 && (
        <section className="home-section" aria-labelledby="recently-resolved-title">
          <div className="home-section-heading">
            <h2 id="recently-resolved-title">Recently resolved</h2>
            <Link href="/markets?status=RESOLVED">View all resolved →</Link>
          </div>
          <div className="home-resolved-grid">
            {resolved.map((market) => (
              <Link
                key={market.address}
                href={`/market/${market.slug}`}
                className="home-resolved-card"
              >
                <span className="home-resolved-asset">{market.assetSymbol}</span>
                <span className="home-resolved-question">{market.question}</span>
                <span
                  className={`home-resolved-outcome home-resolved-${market.side.toLowerCase()}`}
                >
                  {market.side} won
                </span>
                <span className="home-resolved-volume">
                  {groupedAmount(market.totalPool)} {market.collateralSymbol}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

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

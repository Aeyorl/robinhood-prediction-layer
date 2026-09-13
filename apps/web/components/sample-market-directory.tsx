"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MARKET_CATEGORIES,
  SAMPLE_MARKET_STATUSES,
  type MarketCategory,
  type SampleMarket,
  type SampleMarketStatus,
} from "@/lib/sample-markets";
import { SignalOrbShader } from "@/components/signal-orb-shader";
type MemeDiscoveryState = { status: "live" } | { status: "unavailable"; message: string };

function AnimatedSignalOrbit({ market }: { market: SampleMarket }) {
  const orbitRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const [yesShare, setYesShare] = useState(0);
  const [noShare, setNoShare] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setYesShare(market.yesShare);
      setNoShare(market.noShare);
      return;
    }

    const startedAt = performance.now();
    const duration = 1100;
    const count = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setYesShare(Math.round(market.yesShare * eased));
      setNoShare(Math.round(market.noShare * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(count);
    };
    frameRef.current = requestAnimationFrame(count);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [market.noShare, market.yesShare]);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    orbitRef.current?.style.setProperty("--signal-x", `${x * 12}px`);
    orbitRef.current?.style.setProperty("--signal-y", `${y * 10}px`);
    orbitRef.current?.style.setProperty("--signal-rotate-x", `${y * -2}deg`);
    orbitRef.current?.style.setProperty("--signal-rotate-y", `${x * 2}deg`);
  };

  const resetPointer = () => {
    orbitRef.current?.style.setProperty("--signal-x", "0px");
    orbitRef.current?.style.setProperty("--signal-y", "0px");
    orbitRef.current?.style.setProperty("--signal-rotate-x", "0deg");
    orbitRef.current?.style.setProperty("--signal-rotate-y", "0deg");
  };

  return (
    <div
      ref={orbitRef}
      className="featured-sample-orbit"
      aria-label={`YES ${market.yesShare}%, NO ${market.noShare}%`}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
    >
      <div className="featured-signal-visual" aria-hidden="true">
        <div className="featured-signal-image" />
        <SignalOrbShader yesShare={market.yesShare} />
        <div className="featured-signal-sweep" />
      </div>
      <div className="featured-sample-half featured-sample-yes">
        <strong>▲ YES {yesShare}%</strong>
        <small>capital share</small>
      </div>
      <div className="featured-sample-half featured-sample-no">
        <strong>⬡ NO {noShare}%</strong>
        <small>capital share</small>
      </div>
    </div>
  );
}

export function SampleMarketDirectory({
  markets,
  memeDiscovery,
}: {
  markets: readonly SampleMarket[];
  memeDiscovery: MemeDiscoveryState;
}) {
  const [category, setCategory] = useState<"ALL" | MarketCategory>("ALL");
  const [status, setStatus] = useState<"ALL" | SampleMarketStatus>("ALL");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"VOLUME" | "YES" | "CLOSE">("VOLUME");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return markets
      .filter((m) => category === "ALL" || m.category === category)
      .filter((m) => status === "ALL" || m.status === status)
      .filter(
        (m) =>
          !normalized ||
          m.symbol.toLowerCase().includes(normalized) ||
          m.assetName.toLowerCase().includes(normalized) ||
          m.question.toLowerCase().includes(normalized),
      )
      .slice()
      .sort((a, b) =>
        sort === "YES"
          ? b.yesShare - a.yesShare
          : sort === "CLOSE"
            ? a.closeTime.localeCompare(b.closeTime)
            : Number.parseInt(b.volume, 10) - Number.parseInt(a.volume, 10),
      );
  }, [category, markets, query, sort, status]);
  const featured = filtered[0] ?? markets[0];
  return (
    <div className="market-signals-directory">
      <header className="market-signals-heading">
        <div>
          <h1 className="block-heading">Market signals</h1>
          <p>
            <i /> {markets.length} discovery markets · demonstration capital share
          </p>
        </div>
        <section className="market-signal-toolbar" aria-label="Market filters">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search markets"
            aria-label="Search markets"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as "ALL" | MarketCategory)}
            aria-label="Category"
          >
            <option value="ALL">All assets</option>
            {MARKET_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item === "MEMECOINS" ? "Memecoins" : "Stocks"}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "ALL" | SampleMarketStatus)}
            aria-label="Status"
          >
            <option value="ALL">All states</option>
            {SAMPLE_MARKET_STATUSES.map((item) => (
              <option key={item} value={item}>
                {item.replace("_", " ")}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "VOLUME" | "YES" | "CLOSE")}
            aria-label="Sort markets"
          >
            <option value="VOLUME">Volume</option>
            <option value="YES">Highest YES share</option>
            <option value="CLOSE">Close date</option>
          </select>
        </section>
      </header>
      {memeDiscovery.status === "unavailable" && (
        <div className="sample-unavailable-state">
          <strong>Robinhood meme discovery unavailable</strong>
          <p>{memeDiscovery.message}</p>
        </div>
      )}
      {filtered.length && featured ? (
        <>
          <Link href={`/market/${featured.slug}`} className="featured-sample-signal">
            <div className="featured-signal-copy">
              <span>Featured broadcast · {featured.status.replace("_", " ")}</span>
              <h2>{featured.symbol}</h2>
              <p>{featured.question}</p>
              <dl>
                <div>
                  <dt>Sample volume</dt>
                  <dd>{featured.volume}</dd>
                </div>
                <div>
                  <dt>Resolution source</dt>
                  <dd>{featured.oracle}</dd>
                </div>
              </dl>
            </div>
            <AnimatedSignalOrbit market={featured} />
          </Link>
          <div className="activity-tape market-sample-tape">
            <span className="tape-live">
              Sample state <i />
            </span>
            {filtered.slice(0, 4).map((market) => (
              <span key={market.slug}>
                <b>{market.symbol}</b> <span className="yes-copy">▲ {market.yesShare}%</span>{" "}
                <span className="no-copy">○ {market.noShare}%</span>
              </span>
            ))}
          </div>
          <div className="light-market-grid signal-market-grid">
            {filtered.slice(0, 6).map((market) => (
              <LightSampleMarketCard key={market.slug} market={market} />
            ))}
          </div>
        </>
      ) : (
        <div className="sample-empty-state">
          <strong>No sample markets match these filters.</strong>
          <p>Clear a filter or search for another asset.</p>
        </div>
      )}
      <p className="sample-risk-line">
        Capital share is not guaranteed probability. Sample figures are illustrative and do not
        represent open positions or live liquidity.
      </p>
    </div>
  );
}

export function SampleMarketCard({ market }: { market: SampleMarket }) {
  return (
    <Link href={`/market/${market.slug}`} className="sample-market-card">
      <div className="sample-card-topline">
        <span className={`sample-category sample-category-${market.category.toLowerCase()}`}>
          {market.category === "MEMECOINS" ? "Memecoin" : "Stock"}
        </span>
        <span className={`sample-status sample-status-${market.status.toLowerCase()}`}>
          {market.status.replace("_", " ")}
        </span>
      </div>
      <div className="sample-asset-line">
        <strong>{market.symbol}</strong>
        <span>{market.assetName}</span>
      </div>
      <h2>{market.question}</h2>
      <div className="sample-card-meta">
        <span>{market.closeLabel}</span>
        <span>{market.volume} volume</span>
      </div>
      {market.sourceLabel && (
        <span className="sample-data-source">
          {market.sourceLabel} · {market.marketCapLabel}
        </span>
      )}
      <div
        className="sample-shares"
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
      <span className="sample-card-footer">Preview market · View terms →</span>
    </Link>
  );
}

export function LightSampleMarketCard({ market }: { market: SampleMarket }) {
  return (
    <Link href={`/market/${market.slug}`} className="light-market-card">
      <div className="light-market-meta">
        <span className="light-asset-mark" aria-hidden="true">
          {market.symbol.slice(0, 2)}
        </span>
        <strong>{market.symbol}</strong>
        <span className="market-kind">
          {market.category === "MEMECOINS" ? "Memecoin" : "Stock"}
        </span>
        <span className="market-volume">
          <b>{market.volume}</b>
          <small>sample volume</small>
        </span>
      </div>
      <h3>{market.question}</h3>
      <div className="market-timing">
        <span className="clock-mark" aria-hidden="true" />
        <span>{market.closeLabel}</span>
        <span className="oracle-copy">Source: {market.oracle}</span>
      </div>
      <div
        className="market-outcomes"
        aria-label={`YES ${market.yesShare}% capital share, NO ${market.noShare}% capital share`}
      >
        <span className="market-yes">
          <b>▲ YES</b>
          <strong>{market.yesShare}%</strong>
          <small>capital share</small>
        </span>
        <span className="market-no">
          <b>○ NO</b>
          <strong>{market.noShare}%</strong>
          <small>capital share</small>
        </span>
      </div>
    </Link>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  MARKET_CATEGORIES,
  SAMPLE_MARKET_STATUSES,
  type MarketCategory,
  type SampleMarket,
  type SampleMarketStatus,
} from "@/lib/sample-markets";

export function SampleMarketDirectory({ markets }: { markets: readonly SampleMarket[] }) {
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
  return (
    <div className="sample-directory">
      <header className="sample-directory-heading">
        <div>
          <span className="sample-kicker">Public preview</span>
          <h1>Market discovery</h1>
          <p>
            Market discovery is live. Trading opens after onchain deployment and final launch
            checks.
          </p>
        </div>
        <div className="sample-discovery-note">
          <strong>10</strong>
          <span>
            sample markets
            <br />
            for product preview
          </span>
        </div>
      </header>
      <section className="sample-filters" aria-label="Market filters">
        <label>
          <span>Search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assets or markets"
          />
        </label>
        <label>
          <span>Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as "ALL" | MarketCategory)}
          >
            <option value="ALL">All assets</option>
            {MARKET_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item === "MEMECOINS" ? "Memecoins" : "Stocks"}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "ALL" | SampleMarketStatus)}
          >
            <option value="ALL">All states</option>
            {SAMPLE_MARKET_STATUSES.map((item) => (
              <option key={item} value={item}>
                {item.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "VOLUME" | "YES" | "CLOSE")}
          >
            <option value="VOLUME">Volume</option>
            <option value="YES">Highest YES share</option>
            <option value="CLOSE">Close date</option>
          </select>
        </label>
      </section>
      {filtered.length ? (
        <div className="sample-market-grid">
          {filtered.map((market) => (
            <SampleMarketCard key={market.slug} market={market} />
          ))}
        </div>
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

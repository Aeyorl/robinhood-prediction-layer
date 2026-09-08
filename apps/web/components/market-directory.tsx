"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { branding } from "@pl/config";

import { MarketCard } from "@/components/market-card";
import { Countdown, useFormatDate, useNow } from "@/components/countdown";
import {
  groupedAmount,
  MARKET_STATUS,
  type MarketStatus,
  type MarketView,
} from "@/lib/market-view";

export type SortKey = "trending" | "newest" | "closing" | "volume" | "balanced" | "activity";

export type CategoryFilter = "ALL" | "EQUITIES" | "CRYPTO" | "INDICES";
export type ClosingFilter = "ALL" | "24H" | "7D" | "30D";
export type VolumeFilter = "ALL" | "1K" | "5K" | "10K";
export type MarketTypeFilter = "ALL" | "ABOVE" | "BELOW";

function getMarketCategory(market: MarketView): "EQUITIES" | "CRYPTO" | "INDICES" {
  const symbol = market.assetSymbol.toUpperCase();
  if (["ETH", "BTC", "SOL", "USDC", "USDG", "PONS"].some((c) => symbol.includes(c))) {
    return "CRYPTO";
  }
  if (["SPX", "NDX", "DJI", "GOLD", "OIL"].some((c) => symbol.includes(c))) {
    return "INDICES";
  }
  return "EQUITIES";
}

export function MarketDirectory({
  markets,
  initialStatus,
  initialQuery = "",
}: {
  markets: MarketView[];
  initialStatus: "ALL" | MarketStatus;
  initialQuery?: string;
}) {
  const [status, setStatus] = useState<"ALL" | MarketStatus>(initialStatus);
  const [asset, setAsset] = useState("ALL");
  const [sort, setSort] = useState<SortKey>("trending");
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [closingPeriod, setClosingPeriod] = useState<ClosingFilter>("ALL");
  const [volumeTier, setVolumeTier] = useState<VolumeFilter>("ALL");
  const [marketType, setMarketType] = useState<MarketTypeFilter>("ALL");
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const assets = useMemo(
    () => [...new Set(markets.map((market) => market.assetSymbol))].sort(),
    [markets],
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (status !== "ALL") count++;
    if (asset !== "ALL") count++;
    if (category !== "ALL") count++;
    if (closingPeriod !== "ALL") count++;
    if (volumeTier !== "ALL") count++;
    if (marketType !== "ALL") count++;
    if (query.trim() !== "") count++;
    return count;
  }, [asset, category, closingPeriod, marketType, query, status, volumeTier]);

  function resetFilters() {
    setStatus("ALL");
    setAsset("ALL");
    setCategory("ALL");
    setClosingPeriod("ALL");
    setVolumeTier("ALL");
    setMarketType("ALL");
    setQuery("");
    setSort("trending");
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const now = Math.floor(Date.now() / 1000);

    return markets
      .filter((market) => status === "ALL" || market.status === status)
      .filter((market) => asset === "ALL" || market.assetSymbol === asset)
      .filter((market) => category === "ALL" || getMarketCategory(market) === category)
      .filter((market) => {
        if (closingPeriod === "ALL") return true;
        const remaining = market.lockTime - now;
        if (closingPeriod === "24H") return remaining > 0 && remaining <= 86400;
        if (closingPeriod === "7D") return remaining > 0 && remaining <= 7 * 86400;
        if (closingPeriod === "30D") return remaining > 0 && remaining <= 30 * 86400;
        return true;
      })
      .filter((market) => {
        if (volumeTier === "ALL") return true;
        const totalUsdg = Number(BigInt(market.totalPool) / 10n ** 18n);
        if (volumeTier === "1K") return totalUsdg >= 1_000;
        if (volumeTier === "5K") return totalUsdg >= 5_000;
        if (volumeTier === "10K") return totalUsdg >= 10_000;
        return true;
      })
      .filter((market) => {
        if (marketType === "ALL") return true;
        if (marketType === "ABOVE") return market.comparator === "PRICE_ABOVE_AT_TIME";
        if (marketType === "BELOW") return market.comparator === "PRICE_BELOW_AT_TIME";
        return true;
      })
      .filter(
        (market) =>
          normalized === "" ||
          market.question.toLowerCase().includes(normalized) ||
          market.assetSymbol.toLowerCase().includes(normalized),
      )
      .sort((a, b) => {
        if (sort === "trending") {
          const aOpen = a.status === "OPEN" ? 1 : 0;
          const bOpen = b.status === "OPEN" ? 1 : 0;
          if (aOpen !== bOpen) return bOpen - aOpen;
          return Number(BigInt(b.totalPool) - BigInt(a.totalPool));
        }
        if (sort === "newest") {
          return b.openTime - a.openTime;
        }
        if (sort === "volume") {
          return Number(BigInt(b.totalPool) - BigInt(a.totalPool));
        }
        if (sort === "balanced") {
          const aDistance = Math.abs((a.yesSharePct ?? 50) - 50);
          const bDistance = Math.abs((b.yesSharePct ?? 50) - 50);
          return aDistance - bDistance;
        }
        if (sort === "activity") {
          const aVol = Number(BigInt(a.totalPool) / 10n ** 18n);
          const bVol = Number(BigInt(b.totalPool) / 10n ** 18n);
          return bVol - aVol;
        }
        return a.lockTime - b.lockTime;
      });
  }, [asset, category, closingPeriod, marketType, markets, query, sort, status, volumeTier]);

  const featured = useMemo(
    () => [...markets].sort((a, b) => Number(BigInt(b.totalPool) - BigInt(a.totalPool)))[0]!,
    [markets],
  );

  return (
    <div className="market-directory space-y-6">
      <div className="market-signals-heading">
        <div>
          <span className="section-kicker">Live market directory</span>
          <h1 className="block-heading">Market signals</h1>
          <p>
            {markets.length} indexed market{markets.length === 1 ? "" : "s"} · live chain state
          </p>
        </div>

        {/* Primary Search & Sort Toolbar — Spec §5 */}
        <div className="market-signal-toolbar flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="market-search">
            Search markets
          </label>
          <input
            id="market-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search question or asset"
            className="directory-control flex-1 min-w-[180px]"
          />

          <label className="sr-only" htmlFor="market-sort">
            Sort markets
          </label>
          <select
            id="market-sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="directory-control"
          >
            <option value="trending">Sort: Trending</option>
            <option value="newest">Sort: Newest</option>
            <option value="closing">Sort: Closing soon</option>
            <option value="volume">Sort: Highest volume</option>
            <option value="balanced">Sort: Most balanced</option>
            <option value="activity">Sort: Community activity</option>
          </select>

          <button
            type="button"
            onClick={() => setShowMoreFilters((v) => !v)}
            className={`directory-control flex items-center gap-1.5 font-medium transition-colors ${
              showMoreFilters || activeFilterCount > 0 ? "border-[#4b63ff] text-[#4b63ff]" : ""
            }`}
          >
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-[#4b63ff] px-1.5 py-0.2 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
            <span className="text-xs">{showMoreFilters ? "▲" : "▼"}</span>
          </button>
        </div>
      </div>

      {/* Expanded Spec §5 Filters Row */}
      {showMoreFilters && (
        <div className="rounded-xl border border-[#d2cfc8] bg-[#faf9f6] p-3 text-xs shadow-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div>
              <label
                htmlFor="filter-category"
                className="block text-[10px] font-mono uppercase text-[#77736d] mb-1"
              >
                Category
              </label>
              <select
                id="filter-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryFilter)}
                className="directory-control w-full !min-h-[36px] !py-1 text-xs"
              >
                <option value="ALL">All Categories</option>
                <option value="EQUITIES">Tech Equities</option>
                <option value="CRYPTO">Crypto Assets</option>
                <option value="INDICES">Indices & Other</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-underlying"
                className="block text-[10px] font-mono uppercase text-[#77736d] mb-1"
              >
                Underlying
              </label>
              <select
                id="filter-underlying"
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                className="directory-control w-full !min-h-[36px] !py-1 text-xs"
              >
                <option value="ALL">All Assets</option>
                {assets.map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-closing"
                className="block text-[10px] font-mono uppercase text-[#77736d] mb-1"
              >
                Closing Period
              </label>
              <select
                id="filter-closing"
                value={closingPeriod}
                onChange={(e) => setClosingPeriod(e.target.value as ClosingFilter)}
                className="directory-control w-full !min-h-[36px] !py-1 text-xs"
              >
                <option value="ALL">Any Closing Time</option>
                <option value="24H">Closing in 24h</option>
                <option value="7D">Closing in 7 days</option>
                <option value="30D">Closing in 30 days</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-volume"
                className="block text-[10px] font-mono uppercase text-[#77736d] mb-1"
              >
                Volume
              </label>
              <select
                id="filter-volume"
                value={volumeTier}
                onChange={(e) => setVolumeTier(e.target.value as VolumeFilter)}
                className="directory-control w-full !min-h-[36px] !py-1 text-xs"
              >
                <option value="ALL">Any Volume</option>
                <option value="1K">≥ 1,000 USDG</option>
                <option value="5K">≥ 5,000 USDG</option>
                <option value="10K">≥ 10,000 USDG</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-type"
                className="block text-[10px] font-mono uppercase text-[#77736d] mb-1"
              >
                Market Type
              </label>
              <select
                id="filter-type"
                value={marketType}
                onChange={(e) => setMarketType(e.target.value as MarketTypeFilter)}
                className="directory-control w-full !min-h-[36px] !py-1 text-xs"
              >
                <option value="ALL">All Types</option>
                <option value="ABOVE">Price Above (≥)</option>
                <option value="BELOW">Price Below (&lt;)</option>
              </select>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="mt-3 flex items-center justify-between border-t border-[#e2ded6] pt-2">
              <span className="text-[11px] text-[#77736d]">
                Filtering {filtered.length} of {markets.length} markets
              </span>
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11px] font-bold text-[#4b63ff] hover:underline"
              >
                Reset all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Status pills row */}
      <div className="status-filters market-status-filters" aria-label="Filter by market status">
        {(["ALL", ...MARKET_STATUS] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={status === item}
            onClick={() => setStatus(item)}
            className={status === item ? "active" : ""}
          >
            {item === "ALL" ? "All" : item}
          </button>
        ))}
        <span className="ml-auto text-xs text-stone-500" aria-live="polite">
          {filtered.length} market{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      <FeaturedSignal market={featured} />

      <div className="market-index-tape" aria-label="Indexed market status">
        <strong>Live index</strong>
        {markets.map((market) => (
          <Link key={market.address} href={`/market/${market.slug}`}>
            <b className={market.status === "RESOLVED" ? "no-copy" : "yes-copy"}>{market.status}</b>
            <span>{market.assetSymbol}</span>
            <small>
              {groupedAmount(market.totalPool)} {market.collateralSymbol}
            </small>
          </Link>
        ))}
        <span className="market-index-note">Pools refresh from chain reads.</span>
      </div>

      {filtered.length === 0 ? (
        <div className="route-empty-message">
          <p className="font-medium text-black">No matching markets</p>
          <p className="mt-1 text-sm text-stone-500">Try adjusting your filters or search term.</p>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-3 inline-flex text-xs font-bold text-[#4b63ff] hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="signal-market-grid">
          {filtered.map((market) => (
            <MarketCard key={market.address} market={market} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeaturedSignal({ market }: { market: MarketView }) {
  const resolvedAt = useFormatDate(market.resolvedAt);
  const now = useNow();
  const yes = market.yesSharePct;
  const no = market.noSharePct;

  return (
    <Link href={`/market/${market.slug}`} className="featured-signal">
      <div className="featured-signal-copy">
        <span className="section-kicker">Featured signal</span>
        <h2>{market.assetSymbol}</h2>
        <p>{market.question}</p>
        <div className="featured-signal-state">
          <b>{market.status}</b>
          <span>
            {market.status === "OPEN" && now != null ? (
              <>
                Closes in <Countdown targetSeconds={market.lockTime} />
              </>
            ) : null}
            {market.status === "RESOLVED" ? (
              <>
                {market.side} won{resolvedAt !== "—" ? ` · ${resolvedAt}` : ""}
              </>
            ) : null}
          </span>
        </div>
        <dl>
          <div>
            <dt>Total volume</dt>
            <dd>
              {groupedAmount(market.totalPool)} {market.collateralSymbol}
            </dd>
          </div>
          <div>
            <dt>Oracle</dt>
            <dd>
              {market.feed.slice(0, 6)}…{market.feed.slice(-4)}
            </dd>
          </div>
        </dl>
      </div>
      <div className="featured-signal-visual">
        <Image
          src="/ui/market-signal-orb.png"
          alt="Abstract split capital-share signal"
          fill
          priority
          sizes="(max-width: 950px) 100vw, 55vw"
        />
        <div className="featured-share featured-share-yes">
          <span>YES</span>
          <strong>{yes == null ? "—" : `${yes.toFixed(0)}%`}</strong>
          <small>capital share</small>
        </div>
        <div className="featured-share featured-share-no">
          <span>NO</span>
          <strong>{no == null ? "—" : `${no.toFixed(0)}%`}</strong>
          <small>capital share</small>
        </div>
      </div>
      <span className="featured-signal-chain">Settled on {branding.chainName}</span>
    </Link>
  );
}

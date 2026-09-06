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

type SortKey = "closing" | "volume" | "balanced";

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
  const [sort, setSort] = useState<SortKey>("closing");
  const [query, setQuery] = useState(initialQuery);
  const assets = useMemo(
    () => [...new Set(markets.map((market) => market.assetSymbol))].sort(),
    [markets],
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return markets
      .filter((market) => status === "ALL" || market.status === status)
      .filter((market) => asset === "ALL" || market.assetSymbol === asset)
      .filter(
        (market) =>
          normalized === "" ||
          market.question.toLowerCase().includes(normalized) ||
          market.assetSymbol.toLowerCase().includes(normalized),
      )
      .sort((a, b) => {
        if (sort === "volume") return Number(BigInt(b.totalPool) - BigInt(a.totalPool));
        if (sort === "balanced") {
          const aDistance = Math.abs((a.yesSharePct ?? 50) - 50);
          const bDistance = Math.abs((b.yesSharePct ?? 50) - 50);
          return aDistance - bDistance;
        }
        return a.lockTime - b.lockTime;
      });
  }, [asset, markets, query, sort, status]);
  const featured = useMemo(
    () => [...markets].sort((a, b) => Number(BigInt(b.totalPool) - BigInt(a.totalPool)))[0]!,
    [markets],
  );

  return (
    <div className="market-directory">
      <div className="market-signals-heading">
        <div>
          <span className="section-kicker">Live market directory</span>
          <h1 className="block-heading">Market signals</h1>
          <p>
            {markets.length} indexed market{markets.length === 1 ? "" : "s"} · live chain state
          </p>
        </div>
        <div className="market-signal-toolbar">
          <label className="sr-only" htmlFor="market-search">
            Search markets
          </label>
          <input
            id="market-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search question or asset"
            className="directory-control"
          />
          <label className="sr-only" htmlFor="market-asset">
            Filter by asset
          </label>
          <select
            id="market-asset"
            value={asset}
            onChange={(event) => setAsset(event.target.value)}
            className="directory-control"
          >
            <option value="ALL">All assets</option>
            {assets.map((symbol) => (
              <option key={symbol}>{symbol}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="market-sort">
            Sort markets
          </label>
          <select
            id="market-sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="directory-control"
          >
            <option value="closing">Closing soon</option>
            <option value="volume">Highest volume</option>
            <option value="balanced">Most balanced</option>
          </select>
        </div>
      </div>

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
          <p className="mt-1 text-sm text-stone-500">Try another status, asset, or search term.</p>
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

"use client";

import { useMemo, useState } from "react";

import { MarketCard } from "@/components/market-card";
import { MARKET_STATUS, type MarketStatus, type MarketView } from "@/lib/market-view";

type SortKey = "closing" | "volume" | "balanced";

export function MarketDirectory({
  markets,
  initialStatus,
}: {
  markets: MarketView[];
  initialStatus: "ALL" | MarketStatus;
}) {
  const [status, setStatus] = useState<"ALL" | MarketStatus>(initialStatus);
  const [asset, setAsset] = useState("ALL");
  const [sort, setSort] = useState<SortKey>("closing");
  const [query, setQuery] = useState("");
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

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-2xl border border-white/[0.08] bg-slate-900/55 p-3 sm:grid-cols-2 lg:grid-cols-[minmax(15rem,1fr)_auto_auto]">
        <label className="sr-only" htmlFor="market-search">
          Search markets
        </label>
        <input
          id="market-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search question or asset"
          className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none"
        />
        <label className="sr-only" htmlFor="market-asset">
          Filter by asset
        </label>
        <select
          id="market-asset"
          value={asset}
          onChange={(event) => setAsset(event.target.value)}
          className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-slate-200"
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
          className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-slate-200"
        >
          <option value="closing">Closing soon</option>
          <option value="volume">Highest volume</option>
          <option value="balanced">Most balanced</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2" aria-label="Filter by market status">
        {(["ALL", ...MARKET_STATUS] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={status === item}
            onClick={() => setStatus(item)}
            className={
              status === item
                ? "min-h-10 rounded-full bg-indigo-500/20 px-4 text-xs font-semibold text-indigo-200 ring-1 ring-indigo-400/40"
                : "min-h-10 rounded-full bg-white/[0.05] px-4 text-xs font-medium text-slate-400 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
            }
          >
            {item === "ALL" ? "All" : item}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500" aria-live="polite">
          {filtered.length} market{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
          <p className="font-medium text-white">No matching markets</p>
          <p className="mt-1 text-sm text-slate-500">Try another status, asset, or search term.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((market) => (
            <MarketCard key={market.address} market={market} />
          ))}
        </div>
      )}
    </div>
  );
}

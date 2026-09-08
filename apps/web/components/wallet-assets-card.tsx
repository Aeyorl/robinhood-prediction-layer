"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useInfiniteQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";

import { Card, Skeleton, StatusBadge } from "@pl/ui";
import { type AssetBalance, type AssetSupportStatus } from "@pl/types";
import { getWalletAssets } from "@/lib/funding-api";

export function getSpecStatusBadge(status: AssetSupportStatus): {
  label: "Ready" | "High impact" | "No route" | "Unverified";
  tone: "green" | "amber" | "rose" | "slate";
} {
  switch (status) {
    case "SUPPORTED":
      return { label: "Ready", tone: "green" };
    case "HIGH_IMPACT":
      return { label: "High impact", tone: "amber" };
    case "NO_ROUTE":
    case "UNSAFE_BEHAVIOR":
    case "BLOCKED":
      return { label: "No route", tone: "rose" };
    case "UNKNOWN":
    case "DISCOVERED":
    case "QUOTE_PENDING":
    case "DUST":
    default:
      return { label: "Unverified", tone: "slate" };
  }
}

export function WalletAssetsCard({ showAllLink = true }: { showAllLink?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Your wallet assets</h2>
          <p className="text-xs text-slate-400">
            ERC-20 balances with live route eligibility to USDG collateral for predictions.
          </p>
        </div>
        {showAllLink && (
          <Link
            href="/assets"
            className="text-xs font-semibold text-indigo-300 hover:text-indigo-200"
          >
            View all assets →
          </Link>
        )}
      </div>

      {!mounted ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      ) : (
        <WalletAssetsBody />
      )}
    </div>
  );
}

function WalletAssetsBody() {
  const { address, chainId } = useAccount();
  const [filter, setFilter] = useState<"ALL" | "READY" | "ATTENTION">("ALL");

  const result = useInfiniteQuery({
    queryKey: ["wallet-assets", address, chainId],
    queryFn: ({ pageParam }) => getWalletAssets(address!, pageParam),
    initialPageParam: 0,
    getNextPageParam: (page) => page.nextOffset ?? undefined,
    enabled: !!address,
    retry: false,
  });

  const assets: AssetBalance[] = useMemo(() => {
    if (!result.data?.pages) return [];
    return [
      ...new Map(
        result.data.pages.flatMap((p) => p.assets).map((a) => [a.token.address, a]),
      ).values(),
    ];
  }, [result.data]);

  const filtered = useMemo(() => {
    if (filter === "READY") {
      return assets.filter((a) => getSpecStatusBadge(a.supportStatus).label === "Ready");
    }
    if (filter === "ATTENTION") {
      return assets.filter((a) => getSpecStatusBadge(a.supportStatus).label !== "Ready");
    }
    return assets;
  }, [assets, filter]);

  if (!address) {
    return (
      <Card className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-sm font-semibold text-white">Connect wallet to view token assets</p>
        <p className="mt-1 text-xs text-slate-400">
          We read ERC-20 balances directly to show available prediction funding routes.
        </p>
      </Card>
    );
  }

  if (result.isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
      </div>
    );
  }

  if (result.error) {
    return (
      <Card className="p-4 text-center">
        <p role="alert" className="text-sm text-amber-300">
          Asset discovery unavailable.
        </p>
        <button
          type="button"
          onClick={() => result.refetch()}
          className="mt-2 text-xs font-bold text-indigo-400 hover:underline"
        >
          Retry discovery
        </button>
      </Card>
    );
  }

  if (result.data?.pages[0]?.chainId !== chainId) {
    return (
      <Card className="p-4 text-center text-sm text-amber-300">
        Switch your wallet to the configured Robinhood Chain network to discover balances.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      {assets.length > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={`rounded-lg px-3 py-1 font-medium transition-colors ${
              filter === "ALL"
                ? "bg-white/10 text-white font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All assets ({assets.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("READY")}
            className={`rounded-lg px-3 py-1 font-medium transition-colors ${
              filter === "READY"
                ? "bg-emerald-500/20 text-emerald-300 font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Ready to trade (
            {assets.filter((a) => getSpecStatusBadge(a.supportStatus).label === "Ready").length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("ATTENTION")}
            className={`rounded-lg px-3 py-1 font-medium transition-colors ${
              filter === "ATTENTION"
                ? "bg-amber-500/20 text-amber-300 font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Routing attention (
            {assets.filter((a) => getSpecStatusBadge(a.supportStatus).label !== "Ready").length})
          </button>
        </div>
      )}

      {/* Launchpad-style token card grid — Spec §10 */}
      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-300">
            {assets.length === 0
              ? "No readable token balances found in this wallet."
              : "No tokens matching the selected filter."}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Deposit or swap tokens on Robinhood Chain to see them here.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((asset) => (
            <LaunchpadTokenCard key={asset.token.address} asset={asset} />
          ))}
        </div>
      )}

      {result.hasNextPage && (
        <div className="pt-2 text-center">
          <button
            type="button"
            disabled={result.isFetchingNextPage}
            onClick={() => result.fetchNextPage()}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-indigo-300 hover:bg-white/10"
          >
            {result.isFetchingNextPage ? "Loading more assets…" : "Load more assets"}
          </button>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Support is amount-specific and does not certify token safety. Liquidity routes are
        re-verified onchain before trade confirmation.
      </p>
    </div>
  );
}

function LaunchpadTokenCard({ asset }: { asset: AssetBalance }) {
  const badge = getSpecStatusBadge(asset.supportStatus);

  const rawUnits = Number(formatUnits(BigInt(asset.balance), asset.decimals));
  const formattedBalance = rawUnits.toLocaleString(undefined, {
    maximumFractionDigits: rawUnits < 1 ? 4 : 2,
  });

  const estUsdg = asset.usdgEstimate
    ? Number(formatUnits(BigInt(asset.usdgEstimate), 18)).toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })
    : null;

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06] hover:shadow-xl hover:shadow-indigo-950/20">
      <div>
        {/* Token Image / Icon & Status Badge — Spec §10 */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 text-base font-bold text-indigo-300 shadow-inner">
              {asset.symbol.slice(0, 4).toUpperCase()}
            </div>
            <div>
              <h3 className="text-base font-bold text-white group-hover:text-indigo-200">
                {asset.name}
              </h3>
              <p className="font-mono text-xs font-semibold text-slate-400">
                ${asset.symbol.toUpperCase()}
              </p>
            </div>
          </div>
          <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
        </div>

        {/* Balance & Estimated Value Box */}
        <div className="mt-4 rounded-xl border border-white/5 bg-black/30 p-3 font-mono text-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span>Balance:</span>
            <strong className="text-slate-100">{formattedBalance}</strong>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-slate-400">
            <span>Est. value:</span>
            <strong className="text-emerald-400 font-bold">
              {estUsdg ? `${estUsdg} USDG` : "—"}
            </strong>
          </div>
        </div>

        <p
          className="mt-2 truncate font-mono text-[10px] text-slate-500"
          title={asset.token.address}
        >
          {asset.token.address}
        </p>
      </div>

      {/* Primary Action Button — Spec §10 */}
      <div className="mt-4 pt-1">
        {badge.label === "Ready" || badge.label === "High impact" ? (
          <Link
            href={`/markets?asset=${asset.symbol}`}
            className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-500"
          >
            Use for predictions →
          </Link>
        ) : (
          <span className="flex w-full cursor-not-allowed items-center justify-center rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs font-medium text-slate-500">
            {badge.label === "No route" ? "No route to USDG" : "Unsupported route"}
          </span>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Card, Skeleton, StatusBadge } from "@pl/ui";
import { useAccount } from "wagmi";
import { useInfiniteQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { getWalletAssets } from "@/lib/funding-api";

export function WalletAssetsCard({ showAllLink = true }: { showAllLink?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Your wallet assets</h2>
          <p className="text-xs text-slate-500">
            ERC-20 balances with route eligibility to USDG collateral.
          </p>
        </div>
        {showAllLink && (
          <Link
            href="/assets"
            className="text-xs font-semibold text-indigo-300 hover:text-indigo-200"
          >
            View all →
          </Link>
        )}
      </div>

      {!mounted ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <WalletAssetsBody />
      )}
    </Card>
  );
}

function WalletAssetsBody() {
  const { address, chainId } = useAccount();
  const result = useInfiniteQuery({
    queryKey: ["wallet-assets", address, chainId],
    queryFn: ({ pageParam }) => getWalletAssets(address!, pageParam),
    initialPageParam: 0,
    getNextPageParam: (page) => page.nextOffset ?? undefined,
    enabled: !!address,
    retry: false,
  });

  if (!address) {
    return (
      <>
        <p className="text-sm text-slate-400">
          Connect an EVM wallet to discover the tokens you can use for predictions.
        </p>
        <StatusBadge tone="slate">No wallet connected</StatusBadge>
      </>
    );
  }

  if (result.isPending)
    return <p className="text-sm text-slate-400">Discovering wallet balances…</p>;
  if (result.error)
    return (
      <p role="alert" className="text-sm text-amber-300">
        Asset discovery unavailable. <button onClick={() => result.refetch()}>Retry</button>
      </p>
    );
  if (result.data?.pages[0]?.chainId !== chainId)
    return (
      <p className="text-sm text-amber-300">
        Switch your wallet to the API’s configured Robinhood Chain network.
      </p>
    );
  const assets = [
    ...new Map(
      result.data.pages.flatMap((p) => p.assets).map((a) => [a.token.address, a]),
    ).values(),
  ];
  return (
    <div className="space-y-3">
      {assets.length === 0 && (
        <p className="text-sm text-slate-400">
          No readable token balances found. Discovery covers indexed transfers and configured
          fallback tokens.
        </p>
      )}
      {assets.map((asset) => (
        <div key={asset.token.address} className="rounded-xl border border-white/10 p-3">
          <div className="flex justify-between gap-2">
            <span>
              {asset.name} ({asset.symbol})
            </span>
            <StatusBadge tone={asset.supportStatus === "SUPPORTED" ? "green" : "slate"}>
              {asset.supportStatus}
            </StatusBadge>
          </div>
          <p className="text-sm">
            {formatUnits(BigInt(asset.balance), asset.decimals)} {asset.symbol}
            {asset.usdgEstimate && ` ≈ ${formatUnits(BigInt(asset.usdgEstimate), 18)} USDG`}
          </p>
          <p className="break-all font-mono text-xs text-slate-500">
            {asset.token.chainId} · {asset.token.address}
          </p>
          {asset.supportStatus === "SUPPORTED" && (
            <Link href="/markets" className="text-sm text-indigo-300">
              Use for predictions →
            </Link>
          )}
        </div>
      ))}
      {result.hasNextPage && (
        <button
          disabled={result.isFetchingNextPage}
          onClick={() => result.fetchNextPage()}
          className="text-sm text-indigo-300"
        >
          Load more assets
        </button>
      )}
      <p className="text-xs text-slate-500">
        Support is amount-specific and does not certify token safety. Quotes are checked again
        before trading.
      </p>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Card, Skeleton, StatusBadge } from "@pl/ui";
import { useAccount } from "wagmi";

export function WalletAssetsCard() {
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
        <Link href="/assets" className="text-xs text-indigo-400 hover:text-indigo-300">
          View all →
        </Link>
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
  const { address } = useAccount();

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

  return (
    <p className="text-sm text-slate-400">
      Connected as <span className="font-mono text-xs text-slate-300">{address}</span>. Balance
      discovery and quote eligibility are part of the funding-layer milestone.
    </p>
  );
}

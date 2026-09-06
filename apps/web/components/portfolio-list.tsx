"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { binaryPoolMarketAbi } from "@pl/sdk";
import { Badge, Button, Card, StatusBadge } from "@pl/ui";
import { useAccount, useChainId, usePublicClient } from "wagmi";

import { groupedAmount, type MarketView } from "@/lib/market-view";
import { getWalletTrades } from "@/lib/funding-api";

function addr(a: string): `0x${string}` {
  return a as `0x${string}`;
}

interface PositionRow {
  market: MarketView;
  yesStake: bigint;
  noStake: bigint;
  claimed: boolean;
  totalStake: bigint;
  /** true when the wallet can claim or refund right now */
  actionable: boolean;
  claimableReason: string | null;
}

type Tab = "active" | "claimable" | "resolved" | "history";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "active", label: "Active" },
  { key: "claimable", label: "Claimable" },
  { key: "resolved", label: "Resolved" },
  { key: "history", label: "History" },
];

export function PortfolioList({ markets }: { markets: MarketView[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <PortfolioBody markets={markets} /> : <Card>Loading portfolio…</Card>;
}

function PortfolioBody({ markets }: { markets: MarketView[] }) {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const publicClient = usePublicClient();
  const [tab, setTab] = useState<Tab>("active");

  const wrongChain = isConnected && walletChainId !== markets[0]?.chainId;
  const enabled = isConnected && !wrongChain && !!address && !!publicClient;
  const funding = useQuery({
    queryKey: ["portfolio-funding", address, walletChainId],
    queryFn: () => getWalletTrades(address!),
    enabled,
    retry: false,
    refetchInterval: 10_000,
  });

  // Direct per-market reads (no multicall3 dependency — anvil and some
  // testnets don't deploy it).
  const { data, isFetching } = useQuery({
    queryKey: ["portfolio-positions", markets.map((m) => m.address).join(","), address, enabled],
    queryFn: async () => {
      if (!publicClient || !address) throw new Error("not connected");
      const perMarket = await Promise.all(
        markets.map(async (m) => {
          const [yesStake, noStake, claimed] = await Promise.all([
            publicClient.readContract({
              address: addr(m.address),
              abi: binaryPoolMarketAbi,
              functionName: "userYesStake",
              args: [address],
            }),
            publicClient.readContract({
              address: addr(m.address),
              abi: binaryPoolMarketAbi,
              functionName: "userNoStake",
              args: [address],
            }),
            publicClient.readContract({
              address: addr(m.address),
              abi: binaryPoolMarketAbi,
              functionName: "hasClaimed",
              args: [address],
            }),
          ]);
          return {
            yesStake: yesStake as bigint,
            noStake: noStake as bigint,
            claimed: claimed as boolean,
          };
        }),
      );
      return perMarket;
    },
    enabled,
    refetchInterval: 5_000,
  });

  const rows: PositionRow[] = useMemo(() => {
    if (!data) return [];
    return markets.map((market, i) => {
      const { yesStake, noStake, claimed } = data[i] ?? {
        yesStake: 0n,
        noStake: 0n,
        claimed: false,
      };
      const totalStake = yesStake + noStake;

      let actionable = false;
      let claimableReason: string | null = null;
      if (market.status === "RESOLVED") {
        const stakeOnWin = market.side === "YES" ? yesStake : market.side === "NO" ? noStake : 0n;
        if (stakeOnWin > 0n && !claimed) {
          actionable = true;
          claimableReason = "Claim payout";
        } else if (totalStake > 0n) {
          claimableReason = claimed ? "Claimed" : "Losing side — nothing to claim";
        }
      } else if (market.status === "CANCELLED") {
        if (totalStake > 0n && !claimed) {
          actionable = true;
          claimableReason = "Refund";
        } else if (totalStake > 0n) {
          claimableReason = "Refunded";
        }
      } else if (totalStake > 0n) {
        claimableReason = "In market";
      }

      return { market, yesStake, noStake, claimed, totalStake, actionable, claimableReason };
    });
  }, [data, markets]);

  const withPosition = rows.filter((r) => r.totalStake > 0n);

  const visible = withPosition.filter((r) => {
    switch (tab) {
      case "active":
        return r.market.status === "OPEN" || r.market.status === "LOCKED";
      case "claimable":
        return r.actionable;
      case "resolved":
        return r.market.status === "RESOLVED" || r.market.status === "CANCELLED";
      case "history":
        return true;
    }
  });

  return (
    <div className="space-y-4">
      {!isConnected ? (
        <Card className="space-y-2">
          <h2 className="text-base font-semibold text-white">Connect to see your positions</h2>
          <p className="text-sm text-slate-400">
            Your positions are read directly from the chain for your wallet address — no account
            signup needed.
          </p>
          <Link
            href="/markets"
            className="inline-flex text-sm font-semibold text-indigo-300 hover:text-indigo-200"
          >
            Explore markets →
          </Link>
        </Card>
      ) : wrongChain ? (
        <Card>
          <p className="text-sm text-amber-400">
            Wrong network — switch to Robinhood Chain (chain id 46630) to view your positions.
          </p>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={
                  tab === t.key
                    ? "min-h-10 rounded-full bg-indigo-500/20 px-4 text-xs font-semibold text-indigo-200 ring-1 ring-indigo-400/40"
                    : "min-h-10 rounded-full bg-white/5 px-4 text-xs text-slate-300 ring-1 ring-white/10 hover:bg-white/10"
                }
              >
                {t.label}
              </button>
            ))}
            {isFetching && <span className="ml-1 text-xs text-slate-500">refreshing…</span>}
          </div>

          {visible.length === 0 ? (
            <Card className="border-dashed text-sm text-slate-400">
              {tab === "claimable"
                ? "Nothing claimable right now. Resolved winners and cancelled-market refunds show up here."
                : withPosition.length === 0
                  ? "You have no positions yet. Browse markets and enter with USDG."
                  : "No positions in this tab."}
            </Card>
          ) : (
            <div className="space-y-3">
              {visible.map((r) => (
                <div key={r.market.address}>
                  <PositionCard row={r} />
                  {funding.data?.chainId === r.market.chainId &&
                    funding.data.trades
                      .filter(
                        (t) =>
                          t.marketAddress.toLowerCase() === r.market.address.toLowerCase() &&
                          t.fundingTokenAddress,
                      )
                      .map((t) => (
                        <p key={t.txHash} className="mt-1 break-all px-3 text-xs text-slate-400">
                          {groupedAmount(t.amountUsdg)} USDG funded with {t.fundingTokenAddress} ·{" "}
                          {t.attribution === "SESSION_CORRELATED"
                            ? "session-correlated, not trustless attribution"
                            : t.attribution}
                        </p>
                      ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PositionCard({ row }: { row: PositionRow }) {
  const { market, yesStake, noStake, totalStake, actionable, claimableReason } = row;
  const totalPool = BigInt(market.totalPool);
  const shareOfPool = totalPool > 0n ? Number((totalStake * 10_000n) / totalPool) / 100 : null;

  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/market/${market.slug}`}
          className="text-sm font-medium text-slate-100 hover:text-indigo-300"
        >
          {market.question}
        </Link>
        <div className="flex items-center gap-2">
          <StatusBadge
            tone={
              market.status === "OPEN"
                ? "green"
                : market.status === "LOCKED"
                  ? "amber"
                  : market.status === "RESOLVED"
                    ? "indigo"
                    : "red"
            }
          >
            {market.status}
          </StatusBadge>
          {actionable && <StatusBadge tone="green">Actionable</StatusBadge>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
        <span>
          Stake:{" "}
          <span className="font-mono text-slate-200">
            {yesStake > 0n ? `YES ${groupedAmount(yesStake.toString())}` : ""}
            {yesStake > 0n && noStake > 0n ? " + " : ""}
            {noStake > 0n ? `NO ${groupedAmount(noStake.toString())}` : ""} USDG
          </span>
        </span>
        <span>
          Share of pool:{" "}
          <span className="text-slate-200">
            {shareOfPool != null ? `${shareOfPool.toFixed(2)}%` : "—"}
          </span>
        </span>
        {claimableReason && (
          <span className="text-slate-300">
            {claimableReason} ·{" "}
            {market.status === "RESOLVED" || market.status === "CANCELLED"
              ? "final"
              : "no early exit in v0"}
          </span>
        )}
        {totalStake > 0n && (
          <Badge>
            {market.status === "RESOLVED"
              ? market.side === "YES"
                ? "YES won"
                : market.side === "NO"
                  ? "NO won"
                  : "—"
              : ""}
          </Badge>
        )}
      </div>
      {actionable && (
        <div>
          <Link href={`/market/${market.slug}#actions`}>
            <Button size="sm">{claimableReason}</Button>
          </Link>
        </div>
      )}
    </Card>
  );
}

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { chains } from "@pl/chain-config";
import { binaryPoolMarketAbi, computePayout } from "@pl/sdk";
import { Button, Spinner } from "@pl/ui";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";

import { getWalletTrades } from "@/lib/funding-api";
import { groupedAmount, type MarketView } from "@/lib/market-view";
import { mapTxError } from "@/lib/tx-errors";

function addr(a: string): `0x${string}` {
  return a as `0x${string}`;
}

function getTxExplorerUrl(chainId: number, txHash: string): string | null {
  try {
    const chain = chains[chainId];
    const base = chain?.blockExplorers?.default?.url;
    return base ? `${base}/tx/${txHash}` : null;
  } catch {
    return null;
  }
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
  return mounted ? (
    <PortfolioBody markets={markets} />
  ) : (
    <div className="portfolio-loading">Loading portfolio…</div>
  );
}

function PortfolioBody({ markets }: { markets: MarketView[] }) {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
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

  // Direct per-market reads (no multicall3 dependency — anvil and some testnets don't deploy it).
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
  const totalStake = withPosition.reduce((sum, row) => sum + row.totalStake, 0n);
  const totalYes = withPosition.reduce((sum, row) => sum + row.yesStake, 0n);
  const totalNo = withPosition.reduce((sum, row) => sum + row.noStake, 0n);
  const openCapital = withPosition
    .filter((row) => row.market.status === "OPEN" || row.market.status === "LOCKED")
    .reduce((sum, row) => sum + row.totalStake, 0n);
  const yesPct = totalStake > 0n ? Number((totalYes * 10_000n) / totalStake) / 100 : null;
  const noPct = yesPct == null ? null : 100 - yesPct;

  const tabCounts = useMemo(() => {
    return {
      active: withPosition.filter((r) => r.market.status === "OPEN" || r.market.status === "LOCKED")
        .length,
      claimable: withPosition.filter((r) => r.actionable).length,
      resolved: withPosition.filter(
        (r) => r.market.status === "RESOLVED" || r.market.status === "CANCELLED",
      ).length,
      history: withPosition.length,
    };
  }, [withPosition]);

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
    <div className="portfolio-ledger">
      <div className="portfolio-summary">
        <div className="portfolio-wallet-state">
          <small>Wallet</small>
          <strong>
            {isConnected && address
              ? `${address.slice(0, 6)}…${address.slice(-4)}`
              : "Not connected"}
          </strong>
          <span>
            {isConnected ? "Robinhood Chain" : "Connect from the header to load positions"}
          </span>
        </div>
        <dl>
          <div>
            <dt>Total staked</dt>
            <dd>{isConnected ? `${groupedAmount(totalStake)} USDG` : "—"}</dd>
          </div>
          <div>
            <dt>Open capital</dt>
            <dd>{isConnected ? `${groupedAmount(openCapital)} USDG` : "—"}</dd>
          </div>
          <div>
            <dt>Claimable</dt>
            <dd>
              {isConnected
                ? `${withPosition.filter((row) => row.actionable).length} positions`
                : "—"}
            </dd>
          </div>
          <div>
            <dt>Position history</dt>
            <dd>{isConnected ? `${withPosition.length} markets` : "—"}</dd>
          </div>
        </dl>
      </div>

      <section className="portfolio-exposure" aria-label="Position exposure">
        <div>
          <small>YES positions</small>
          <strong className="yes-copy">{yesPct == null ? "—" : `${yesPct.toFixed(0)}%`}</strong>
          <span>{groupedAmount(totalYes)} USDG</span>
        </div>
        <div
          className={`portfolio-exposure-track ${yesPct == null ? "empty" : ""}`}
          aria-label={yesPct == null ? "No position exposure" : `YES ${yesPct}%, NO ${noPct}%`}
        >
          <span style={{ width: `${yesPct ?? 0}%` }} />
        </div>
        <div>
          <small>NO positions</small>
          <strong className="no-copy">{noPct == null ? "—" : `${noPct.toFixed(0)}%`}</strong>
          <span>{groupedAmount(totalNo)} USDG</span>
        </div>
      </section>

      {!isConnected ? (
        <div className="portfolio-connect-state">
          <span className="section-kicker">Wallet required</span>
          <h2>Connect to see your positions</h2>
          <p>
            Your positions are read directly from the chain for your wallet address — no account
            signup needed.
          </p>
          <Link href="/markets" className="black-action">
            Explore markets <span>→</span>
          </Link>
        </div>
      ) : wrongChain ? (
        <div className="portfolio-connect-state">
          <p>Wrong network — switch to Robinhood Chain (chain id 46630) to view your positions.</p>
        </div>
      ) : (
        <>
          <div className="portfolio-tabs" role="tablist" aria-label="Portfolio filters">
            {TABS.map((t) => {
              const count = tabCounts[t.key];
              const isClaimableAlert = t.key === "claimable" && count > 0;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={tab === t.key ? "active" : ""}
                >
                  <span>{t.label}</span>
                  <span
                    className={`portfolio-tab-pill ${
                      isClaimableAlert
                        ? "bg-emerald-600 text-white font-bold animate-pulse"
                        : tab === t.key
                          ? "bg-black/10 text-black dark:bg-white/20 dark:text-white"
                          : "bg-black/5 text-slate-500 dark:bg-white/10"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
            {isFetching && <span>Refreshing chain state…</span>}
          </div>

          {visible.length === 0 ? (
            <div className="portfolio-empty">
              {tab === "claimable"
                ? "Nothing claimable right now. Resolved winners and cancelled-market refunds show up here."
                : withPosition.length === 0
                  ? "You have no positions yet. Browse markets and enter with USDG."
                  : "No positions in this tab."}
            </div>
          ) : (
            <div className="portfolio-position-list">
              {visible.map((r) => {
                const fundingTrade =
                  funding.data?.chainId === r.market.chainId
                    ? funding.data.trades.find(
                        (t) =>
                          t.marketAddress.toLowerCase() === r.market.address.toLowerCase() &&
                          t.fundingTokenAddress,
                      )
                    : null;

                return (
                  <PositionCard
                    key={r.market.address}
                    row={r}
                    fundingTrade={fundingTrade ?? null}
                    onClaimSuccess={() => {
                      queryClient.invalidateQueries({ queryKey: ["portfolio-positions"] });
                    }}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ClaimButton({
  market,
  isCancelled,
  claimAmount,
  onClaimSuccess,
}: {
  market: MarketView;
  isCancelled: boolean;
  claimAmount: string;
  onClaimSuccess: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const { writeContractAsync } = useWriteContract();

  async function handleAction() {
    setError(null);
    setBusy(true);
    try {
      const hash = await writeContractAsync({
        address: addr(market.address),
        abi: binaryPoolMarketAbi,
        functionName: isCancelled ? "refund" : "claim",
      });
      setTxHash(hash);
      onClaimSuccess();
    } catch (err) {
      setError(mapTxError(err).message);
    } finally {
      setBusy(false);
    }
  }

  if (txHash) {
    const explorerUrl = getTxExplorerUrl(market.chainId, txHash);
    return (
      <div className="flex flex-col items-end gap-1 text-right font-mono">
        <span className="text-xs font-bold text-emerald-600">✓ Claimed</span>
        {explorerUrl ? (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[9px] text-slate-500 underline hover:text-slate-800"
          >
            Explorer ↗
          </a>
        ) : (
          <span className="text-[9px] text-slate-400">
            {txHash.slice(0, 6)}…{txHash.slice(-4)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        disabled={busy}
        onClick={handleAction}
        className="font-mono text-xs font-bold"
      >
        {busy ? (
          <span className="flex items-center gap-1.5">
            <Spinner className="h-3 w-3" />
            Claiming…
          </span>
        ) : isCancelled ? (
          `Refund ${claimAmount}`
        ) : (
          `Claim ${claimAmount}`
        )}
      </Button>
      {error && <span className="max-w-[170px] text-right text-[9px] text-rose-600">{error}</span>}
    </div>
  );
}

function PositionCard({
  row,
  fundingTrade,
  onClaimSuccess,
}: {
  row: PositionRow;
  fundingTrade: {
    txHash: string;
    fundingTokenAddress: string | null;
    amountUsdg: string;
    attribution: "UNKNOWN" | "ONCHAIN" | "SESSION_CORRELATED";
  } | null;
  onClaimSuccess: () => void;
}) {
  const { market, yesStake, noStake, totalStake, claimed, actionable, claimableReason } = row;
  const totalPool = BigInt(market.totalPool);
  const shareOfPool = totalPool > 0n ? Number((totalStake * 10_000n) / totalPool) / 100 : null;

  const isSplit = yesStake > 0n && noStake > 0n;
  const primarySide = isSplit ? "SPLIT" : yesStake > 0n ? "YES" : "NO";

  // Spec §8 & §9 calculations: winning claim breakdown or active projection
  const payoutInfo = useMemo(() => {
    const feeBps = BigInt(market.feeBps || "0");
    const yesPool = BigInt(market.yesPool || "0");
    const noPool = BigInt(market.noPool || "0");

    if (market.status === "RESOLVED") {
      const stakeOnWin = market.side === "YES" ? yesStake : market.side === "NO" ? noStake : 0n;
      const winningPool = market.side === "YES" ? yesPool : noPool;
      const losingPool = market.side === "YES" ? noPool : yesPool;

      if (stakeOnWin > 0n && winningPool > 0n) {
        try {
          return {
            type: "resolved_win" as const,
            stakeOnWin,
            parts: computePayout(stakeOnWin, winningPool, losingPool, feeBps),
          };
        } catch {
          return null;
        }
      }
      return {
        type: "resolved_loss" as const,
        stakeOnWin: 0n,
        parts: null,
      };
    }

    if (market.status === "CANCELLED") {
      return {
        type: "cancelled" as const,
        stakeOnWin: totalStake,
        parts: null,
      };
    }

    // Active market projection
    if (yesStake > 0n && yesPool > 0n && noStake === 0n) {
      try {
        return {
          type: "active_projected" as const,
          stakeOnWin: yesStake,
          parts: computePayout(yesStake, yesPool, noPool, feeBps),
        };
      } catch {
        return null;
      }
    }
    if (noStake > 0n && noPool > 0n && yesStake === 0n) {
      try {
        return {
          type: "active_projected" as const,
          stakeOnWin: noStake,
          parts: computePayout(noStake, noPool, yesPool, feeBps),
        };
      } catch {
        return null;
      }
    }
    return null;
  }, [
    market.status,
    market.side,
    market.feeBps,
    market.yesPool,
    market.noPool,
    yesStake,
    noStake,
    totalStake,
  ]);

  return (
    <article className="border-b border-[#d2cfc8] p-4 transition-colors hover:bg-black/[0.01]">
      <div className="portfolio-position-row !border-b-0 !p-0">
        {/* Market & Side info with Accessible icons */}
        <div className="position-market-cell">
          <span
            className={`position-side-mark ${isSplit ? "split" : yesStake > 0n ? "yes" : "no"}`}
            aria-label={
              isSplit
                ? "Split YES and NO positions"
                : yesStake > 0n
                  ? "YES position"
                  : "NO position"
            }
          >
            {isSplit ? (
              <span className="flex flex-col items-center leading-none">
                <span className="text-xs" aria-hidden="true">
                  ⇄
                </span>
                <span className="text-[8px] font-bold">SPLIT</span>
              </span>
            ) : yesStake > 0n ? (
              <span className="flex flex-col items-center leading-none">
                <span className="text-xs" aria-hidden="true">
                  ✓
                </span>
                <span className="text-[8px] font-bold">YES</span>
              </span>
            ) : (
              <span className="flex flex-col items-center leading-none">
                <span className="text-xs" aria-hidden="true">
                  ✕
                </span>
                <span className="text-[8px] font-bold">NO</span>
              </span>
            )}
          </span>
          <div>
            <Link href={`/market/${market.slug}`} className="hover:underline">
              {market.question}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] text-slate-500">
              <span className="font-semibold text-slate-700">{market.assetSymbol}</span>
              <span>·</span>
              <span className="font-mono">
                {market.address.slice(0, 6)}…{market.address.slice(-4)}
              </span>
              <span>·</span>
              <span>
                {market.status === "OPEN" ? (
                  <>
                    Locks:{" "}
                    <time dateTime={new Date(market.lockTime * 1000).toISOString()}>
                      {new Date(market.lockTime * 1000).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </>
                ) : market.status === "LOCKED" ? (
                  <>
                    Locked · Resolves:{" "}
                    <time dateTime={new Date(market.resolutionTime * 1000).toISOString()}>
                      {new Date(market.resolutionTime * 1000).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </>
                ) : (
                  <>
                    Resolved on{" "}
                    {new Date(
                      (market.resolvedAt ?? market.resolutionTime) * 1000,
                    ).toLocaleDateString()}
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Stake & Collateral */}
        <div className="position-data-cell">
          <small>Stake / Collateral</small>
          <strong>
            {yesStake > 0n ? `YES ${groupedAmount(yesStake.toString())}` : ""}
            {yesStake > 0n && noStake > 0n ? " + " : ""}
            {noStake > 0n ? `NO ${groupedAmount(noStake.toString())}` : ""} USDG
          </strong>
          {fundingTrade ? (
            <span className="text-[9px] text-slate-500" title={fundingTrade.txHash}>
              Funded with:{" "}
              {fundingTrade.fundingTokenAddress
                ? `${fundingTrade.fundingTokenAddress.slice(0, 6)}…${fundingTrade.fundingTokenAddress.slice(-4)}`
                : "Token"}{" "}
              ({groupedAmount(fundingTrade.amountUsdg)} USDG)
            </span>
          ) : (
            <span className="text-[9px] text-slate-500">
              Normalized: {groupedAmount(totalStake)} USDG
            </span>
          )}
        </div>

        {/* Pool Split & Share */}
        <div className="position-data-cell">
          <small>Pool split & share</small>
          <strong>{shareOfPool != null ? `${shareOfPool.toFixed(2)}% of pool` : "—"}</strong>
          <span className="text-[9px] text-slate-500">
            Ratio: {market.yesSharePct ?? 50}% YES · {market.noSharePct ?? 50}% NO
          </span>
        </div>

        {/* Status */}
        <div className="position-data-cell">
          <small>Status</small>
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                market.status === "OPEN"
                  ? "bg-emerald-500"
                  : market.status === "LOCKED"
                    ? "bg-amber-500"
                    : market.status === "RESOLVED"
                      ? "bg-blue-500"
                      : "bg-rose-500"
              }`}
            />
            <strong className="text-xs">{market.status}</strong>
          </div>
          <span>
            {claimableReason ?? (market.status === "OPEN" ? "Accepting capital" : "Closed")}
          </span>
        </div>

        {/* Action */}
        <div className="position-action-cell">
          {actionable ? (
            <ClaimButton
              market={market}
              isCancelled={market.status === "CANCELLED"}
              claimAmount={
                payoutInfo?.type === "resolved_win"
                  ? `${groupedAmount(payoutInfo.parts.net)} USDG`
                  : `${groupedAmount(totalStake)} USDG`
              }
              onClaimSuccess={onClaimSuccess}
            />
          ) : (
            <Link href={`/market/${market.slug}`} className="hover:underline">
              View market →
            </Link>
          )}
        </div>
      </div>

      {/* Spec §9 Claim UX: Transparent 4-part fee breakdown for resolved winners */}
      {payoutInfo?.type === "resolved_win" && (
        <div className="mt-3 rounded border border-emerald-500/20 bg-emerald-500/[0.04] p-3 text-xs">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-300">
              {claimed ? "Payout Claimed" : "🎉 Position Won — Payout Breakdown (Spec §9)"}
            </span>
            <span className="text-[9px] text-slate-500">Parimutuel Fee on Profit</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-[11px]">
            <div>
              <span className="block text-[9px] uppercase text-slate-500">Stake</span>
              <strong>{groupedAmount(payoutInfo.stakeOnWin)} USDG</strong>
            </div>
            <div>
              <span className="block text-[9px] uppercase text-slate-500">Gross payout</span>
              <strong>{groupedAmount(payoutInfo.parts.gross)} USDG</strong>
            </div>
            <div>
              <span className="block text-[9px] uppercase text-slate-500">
                Fee ({Number(market.feeBps) / 100}% on profit)
              </span>
              <span className="text-slate-600">-{groupedAmount(payoutInfo.parts.fee)} USDG</span>
            </div>
            <div>
              <span className="block text-[9px] uppercase font-bold text-emerald-700 dark:text-emerald-400">
                {claimed ? "Claimed Net" : "Claimable Net"}
              </span>
              <strong className="text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                {groupedAmount(payoutInfo.parts.net)} USDG
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Spec §8 Active market projected payout banner */}
      {payoutInfo?.type === "active_projected" && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-black/5 pt-2 text-[10px] text-slate-500">
          <span>
            Capital share: <strong>{shareOfPool?.toFixed(2)}%</strong> ({primarySide} side)
          </span>
          <span className="font-mono">
            Est. payout if win:{" "}
            <strong className="text-slate-900 dark:text-white">
              {groupedAmount(payoutInfo.parts.net)} USDG
            </strong>
            <span className="ml-1 text-slate-400">*(subject to pool changes before lock)</span>
          </span>
        </div>
      )}
    </article>
  );
}

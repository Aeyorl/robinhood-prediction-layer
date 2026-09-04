"use client";

import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { binaryPoolMarketAbi, computePayout, mockErc20Abi } from "@pl/sdk";
import { Badge, Button, Card, Spinner, StatusBadge } from "@pl/ui";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";

import { useNow } from "@/components/countdown";
import { groupedAmount, type MarketView } from "@/lib/market-view";
import { mapTxError, type MappedTxError } from "@/lib/tx-errors";

function addr(a: string): `0x${string}` {
  return a as `0x${string}`;
}

type Action = "lock" | "resolve" | "claim" | "refund";

/**
 * Post-entry lifecycle panel: lock (anyone, after lock time), permissionless
 * resolve via the deterministic oracle, and claim/refund for the connected
 * wallet. All state is read onchain; nothing is inferred.
 */
export function MarketActions({ market }: { market: MarketView }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <Card className="h-40 animate-pulse rounded-2xl bg-white/5" />;
  return <MarketActionsInner market={market} />;
}

// Read-only: resolve feeds don't require wallet writes beyond lifecycle calls.

function MarketActionsInner({ market }: { market: MarketView }) {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const publicClient = usePublicClient();
  // Inner panel only renders after hydration, so a real wall-clock fallback is safe.
  const now = useNow(1_000) ?? Date.now();

  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<MappedTxError | null>(null);
  const [notice, setNotice] = useState<{ hash: string; text: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const onWrongChain = isConnected && walletChainId !== market.chainId;
  const collateralBalanceEnabled = isConnected && !onWrongChain && !!publicClient;

  // ------------------------------------------------------------------
  // Onchain reads: per-wallet stakes/claim state + fresh market status
  // ------------------------------------------------------------------
  const { yesStake, noStake, claimed, balance } = useMarketReads({
    publicClient,
    address,
    market,
    refreshKey,
    enabled: collateralBalanceEnabled,
  });

  const totalStake = yesStake != null && noStake != null ? yesStake + noStake : null;

  // ------------------------------------------------------------------
  // Action availability
  // ------------------------------------------------------------------
  // Note: claim/refund availability derives from the wallet reads below
  // (stake on the winning side, claimed flag) — not from pool totals.
  const canLock = market.status === "OPEN" && now >= market.lockTime * 1000;
  const canResolve = market.status === "LOCKED" && now >= market.resolutionTime * 1000;

  const stakeOnWinningSide =
    yesStake != null && noStake != null
      ? market.side === "YES"
        ? yesStake
        : market.side === "NO"
          ? noStake
          : 0n
      : null;
  const winningPool = market.side === "YES" ? BigInt(market.yesPool) : BigInt(market.noPool);
  const losingPool = market.side === "YES" ? BigInt(market.noPool) : BigInt(market.yesPool);

  const claimPreview = useMemo(() => {
    if (market.status !== "RESOLVED" || stakeOnWinningSide == null || stakeOnWinningSide <= 0n) return null;
    return computePayout(stakeOnWinningSide, winningPool, losingPool, BigInt(market.feeBps));
  }, [market.status, market.feeBps, stakeOnWinningSide, winningPool, losingPool]);


  // ------------------------------------------------------------------
  // Writes
  // ------------------------------------------------------------------
  const { writeContractAsync: write } = useWriteContract();

  async function run(action: Action, fn: () => Promise<`0x${string}`>) {
    setError(null);
    setNotice(null);
    setBusy(action);
    try {
      const hash = await fn();
      const text: Record<Action, string> = {
        lock: "Market locked. Entry is closed; resolution opens at the resolution time.",
        resolve: "Market resolved by the oracle.",
        claim: "Payout claimed to your wallet.",
        refund: "Principal refunded to your wallet.",
      };
      setNotice({ hash, text: text[action] });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(mapTxError(err));
    } finally {
      setBusy(null);
    }
  }

  const actions = {
    lock: () =>
      run("lock", () =>
        write({ address: addr(market.address), abi: binaryPoolMarketAbi, functionName: "lock" }),
      ),
    resolve: () =>
      run("resolve", () =>
        write({ address: addr(market.address), abi: binaryPoolMarketAbi, functionName: "resolve" }),
      ),
    claim: () =>
      run("claim", () =>
        write({ address: addr(market.address), abi: binaryPoolMarketAbi, functionName: "claim" }),
      ),
    refund: () =>
      run("refund", () =>
        write({ address: addr(market.address), abi: binaryPoolMarketAbi, functionName: "refund" }),
      ),
  };

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">Market actions</h3>
        <StatusBadge tone={market.status === "RESOLVED" ? "indigo" : market.status === "CANCELLED" ? "red" : "slate"}>
          {market.status}
        </StatusBadge>
      </div>

      {/* Resolution lifecycle (permissionless) */}
      <div className="space-y-2">
        <p className="text-xs text-slate-400">Lifecycle — anyone can run these once their time gate passes:</p>
        {canLock && (
          <Button className="w-full" variant="secondary" onClick={actions.lock} disabled={busy != null}>
            {busy === "lock" ? <Spinner /> : null}Lock market (entry window over)
          </Button>
        )}
        {canResolve && (
          <Button className="w-full" onClick={actions.resolve} disabled={busy != null}>
            {busy === "resolve" ? <Spinner /> : null}Resolve from oracle
          </Button>
        )}
        {!canLock && !canResolve && market.status !== "RESOLVED" && market.status !== "CANCELLED" && (
          <p className="text-xs text-slate-500">
            No public lifecycle action is available yet — the market is waiting on its time gates.
          </p>
        )}
      </div>

      {/* Connected wallet position */}
      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
        {!isConnected ? (
          <p className="text-sm text-slate-400">
            Connect a wallet to see your position and claim/refund state here.
          </p>
        ) : onWrongChain ? (
          <p className="text-sm text-amber-400">
            Wrong network — connect to Robinhood Chain (chain id 46630) to manage this position.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Your stake</Badge>
              <span className="text-xs text-slate-300">
                YES <span className="font-mono">{yesStake != null ? groupedAmount(yesStake.toString()) : "…"} USDG</span>
              </span>
              <span className="text-xs text-slate-300">
                NO <span className="font-mono">{noStake != null ? groupedAmount(noStake.toString()) : "…"} USDG</span>
              </span>
              {balance != null && (
                <span className="text-xs text-slate-500">
                  USDG balance: {groupedAmount(balance.toString())}
                </span>
              )}
            </div>

            {market.status === "RESOLVED" && (
              <div className="space-y-2">
                <p className="text-xs text-slate-300">
                  {market.side} won at {market.resolvedPrice ?? "—"} USDG.
                </p>
                {claimed ? (
                  <p className="text-xs font-medium text-emerald-400">
                    You have already claimed on this market.
                  </p>
                ) : stakeOnWinningSide != null && stakeOnWinningSide > 0n ? (
                  <div className="space-y-2">
                    {claimPreview && (
                      <p className="text-xs text-slate-400">
                        Claiming pays{" "}
                        <span className="font-semibold text-emerald-400">
                          {groupedAmount(claimPreview.net.toString())} USDG
                        </span>
                        {claimPreview.fee > 0n && ` (fee ${groupedAmount(claimPreview.fee.toString())} USDG)`} on
                        stake {groupedAmount(stakeOnWinningSide.toString())} USDG.
                      </p>
                    )}
                    <Button className="w-full" variant="success" onClick={actions.claim} disabled={busy != null}>
                      {busy === "claim" ? <Spinner /> : null}Claim payout
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Your side did not win — nothing to claim.</p>
                )}
              </div>
            )}

            {market.status === "CANCELLED" && (
              <div className="space-y-2">
                {claimed ? (
                  <p className="text-xs font-medium text-emerald-400">You have already been refunded.</p>
                ) : totalStake != null && totalStake > 0n ? (
                  <Button className="w-full" variant="secondary" onClick={actions.refund} disabled={busy != null}>
                    {busy === "refund" ? <Spinner /> : null}Refund principal ({groupedAmount(totalStake.toString())} USDG)
                  </Button>
                ) : (
                  <p className="text-xs text-slate-500">No stake to refund.</p>
                )}
              </div>
            )}

            {market.status === "OPEN" && totalStake != null && totalStake > 0n && (
              <p className="text-xs text-slate-500">
                You hold a position. Entries close at the lock time; no early exit in v0.
              </p>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className={`text-sm ${error.tone === "warn" ? "text-amber-300" : "text-rose-300"}`}>{error.message}</p>
      )}
      {notice && (
        <p className="break-all rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-300">
          {notice.text} Tx: {notice.hash}
        </p>
      )}
    </Card>
  );
}

function useMarketReads({
  publicClient,
  address,
  market,
  refreshKey,
  enabled,
}: {
  publicClient: ReturnType<typeof usePublicClient>;
  address: `0x${string}` | undefined;
  market: MarketView;
  refreshKey: number;
  enabled: boolean;
}) {
  // Direct readContract calls (no multicall3 dependency). Refetch on refreshKey
  // bump (after a write) and every 5s so pools/claim state stay current.
  const { data } = useQuery({
    queryKey: ["market-reads", market.address, market.collateral, address, refreshKey],
    queryFn: async () => {
      if (!publicClient || !address) throw new Error("not connected");
      const [yesStake, noStake, claimed, balance] = await Promise.all([
        publicClient.readContract({
          address: addr(market.address),
          abi: binaryPoolMarketAbi,
          functionName: "userYesStake",
          args: [address],
        }),
        publicClient.readContract({
          address: addr(market.address),
          abi: binaryPoolMarketAbi,
          functionName: "userNoStake",
          args: [address],
        }),
        publicClient.readContract({
          address: addr(market.address),
          abi: binaryPoolMarketAbi,
          functionName: "hasClaimed",
          args: [address],
        }),
        publicClient.readContract({
          address: addr(market.collateral),
          abi: mockErc20Abi,
          functionName: "balanceOf",
          args: [address],
        }),
      ]);
      return {
        yesStake: yesStake as bigint,
        noStake: noStake as bigint,
        claimed: claimed as boolean,
        balance: balance as bigint,
      };
    },
    enabled,
    refetchInterval: 5_000,
  });

  if (!data) {
    return {
      yesStake: null as bigint | null,
      noStake: null as bigint | null,
      claimed: false,
      balance: null as bigint | null,
    };
  }
  return data;
}

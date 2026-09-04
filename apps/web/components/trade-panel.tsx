"use client";

import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { binaryPoolMarketAbi, computePayout, mockErc20Abi } from "@pl/sdk";
import { Button, Card, Spinner, StatusBadge } from "@pl/ui";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";

import { useNow } from "@/components/countdown";
import { COLLATERAL_DECIMALS, groupedAmount, type MarketView } from "@/lib/market-view";
import { mapTxError, type MappedTxError } from "@/lib/tx-errors";

const ZERO = 0n;

function addr(a: string): `0x${string}` {
  return a as `0x${string}`;
}

/**
 * Direct-collateral (USDG) entry panel for Phase 2. Guided two-step flow:
 * approve (when the allowance is short) then enter. Errors map to explicit
 * messages; transaction hashes are surfaced, never hidden.
 */
export function TradePanel({ market, isLocal }: { market: MarketView; isLocal: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted)
    return (
      <Card className="space-y-3">
        <div className="h-5 w-40 animate-pulse rounded bg-white/10" />
        <div className="h-24 animate-pulse rounded bg-white/5" />
      </Card>
    );
  return <TradePanelInner market={market} isLocal={isLocal} />;
}

function TradePanelInner({ market, isLocal }: { market: MarketView; isLocal: boolean }) {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const publicClient = usePublicClient();
  // Inner panel only renders after hydration, so a real wall-clock fallback is safe.
  const now = useNow(1_000) ?? Date.now();

  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [amountText, setAmountText] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState<"approve" | "enter" | null>(null);
  const [error, setError] = useState<MappedTxError | null>(null);
  const [notice, setNotice] = useState<{ hash: string; text: string } | null>(null);

  // ------------------------------------------------------------------
  // Reads (balance / allowance), refreshed after every tx + every 5s
  // ------------------------------------------------------------------
  const { balance, allowance } = useWalletReads({
    publicClient,
    address,
    collateral: market.collateral,
    marketAddress: market.address,
    refreshKey,
  });

  // ------------------------------------------------------------------
  // Derived values
  // ------------------------------------------------------------------
  const minEntry = BigInt(market.minEntry);
  const amount = useMemo(() => {
    if (!amountText.trim()) return ZERO;
    try {
      const parsed = parseUnits(amountText, COLLATERAL_DECIMALS);
      return parsed < 0n ? ZERO : parsed;
    } catch {
      return ZERO;
    }
  }, [amountText]);

  const onWrongChain = isConnected && walletChainId !== market.chainId;
  const entryOpen =
    market.status === "OPEN" && now >= market.openTime * 1000 && now < market.lockTime * 1000;

  const amountInvalid = amount > 0n && amount < minEntry;
  const exceedsBalance = balance != null && amount > 0n && amount > balance;
  const needsApproval = allowance != null && amount > 0n && allowance < amount;
  const canEnter =
    isConnected && !onWrongChain && entryOpen && amount > 0n && !amountInvalid && !exceedsBalance;

  const sidePool = side === "YES" ? market.yesPool : market.noPool;
  const otherPool = side === "YES" ? market.noPool : market.yesPool;

  const preview = useMemo(() => {
    if (amount <= 0n) return null;
    const winningPool = BigInt(sidePool) + amount;
    const losingPool = BigInt(otherPool);
    if (winningPool <= 0n) return null;
    return computePayout(amount, winningPool, losingPool, BigInt(market.feeBps));
  }, [amount, sidePool, otherPool, market.feeBps]);

  const sharePct =
    amount > 0n ? Number((amount * 10_000n) / (BigInt(sidePool) + amount)) / 100 : null;

  // ------------------------------------------------------------------
  // Writes
  // ------------------------------------------------------------------
  const { writeContractAsync: write } = useWriteContract();

  async function approve() {
    setError(null);
    setNotice(null);
    setBusy("approve");
    try {
      const hash = await write({
        address: addr(market.collateral),
        abi: mockErc20Abi,
        functionName: "approve",
        args: [addr(market.address), amount],
      });
      setNotice({ hash, text: "USDG approved for this market. Submit the entry below." });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(mapTxError(err));
    } finally {
      setBusy(null);
    }
  }

  async function enter() {
    setError(null);
    setNotice(null);
    setBusy("enter");
    try {
      const hash = await write({
        address: addr(market.address),
        abi: binaryPoolMarketAbi,
        functionName: "enter",
        args: [side === "YES" ? 1 : 2, amount],
      });
      setNotice({
        hash,
        text: `Position entered on ${side}: ${groupedAmount(amount.toString())} USDG moved onchain.`,
      });
      setAmountText("");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(mapTxError(err));
    } finally {
      setBusy(null);
    }
  }

  async function mintDemo() {
    if (!isLocal || !address) return;
    setError(null);
    setNotice(null);
    setBusy("approve");
    try {
      const hash = await write({
        address: addr(market.collateral),
        abi: mockErc20Abi,
        functionName: "mint",
        args: [addr(address), parseUnits("100000", COLLATERAL_DECIMALS)],
      });
      setNotice({ hash, text: "Minted 100,000 demo USDG (local chain only)." });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(mapTxError(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">Trade</h3>
        {isLocal && <StatusBadge tone="amber">Local chain</StatusBadge>}
      </div>

      {/* Side selector */}
      <div className="grid grid-cols-2 gap-2">
        {(["YES", "NO"] as const).map((s) => {
          const active = side === s;
          const tone = active
            ? s === "YES"
              ? "border-emerald-400/60 bg-emerald-500/15"
              : "border-rose-400/60 bg-rose-500/15"
            : "border-white/10 bg-white/5 hover:bg-white/10";
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${tone}`}
            >
              <span className="block text-lg font-bold text-white">{s}</span>
              <span className="block text-[11px] text-slate-400">
                Pool share{" "}
                {active
                  ? s === "YES"
                    ? market.yesSharePct != null
                      ? `${market.yesSharePct.toFixed(1)}%`
                      : "—"
                    : market.noSharePct != null
                      ? `${market.noSharePct.toFixed(1)}%`
                      : "—"
                  : "—"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <label htmlFor="amount" className="text-xs font-medium text-slate-400">
          Amount (USDG)
        </label>
        <div className="flex items-center gap-2">
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            placeholder={formatUnits(minEntry, COLLATERAL_DECIMALS)}
            value={amountText}
            onChange={(e) => {
              setError(null);
              setAmountText(e.target.value.replace(/[^0-9.]/g, ""));
            }}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none"
          />
          {isConnected && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                if (balance != null) setAmountText(formatUnits(balance, COLLATERAL_DECIMALS));
              }}
              className="shrink-0 text-xs text-indigo-400 hover:text-indigo-300"
            >
              Max
            </button>
          )}
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>Min {groupedAmount(market.minEntry)} USDG</span>
          <span>
            {isConnected ? (
              <>
                Balance:{" "}
                <span className={exceedsBalance ? "text-rose-400" : "text-slate-300"}>
                  {balance != null ? groupedAmount(balance.toString()) : "…"} USDG
                </span>
              </>
            ) : (
              "Connect a wallet to trade"
            )}
          </span>
        </div>
      </div>

      {/* Quote summary */}
      {preview && (
        <div className="space-y-1 rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>You pay</span>
            <span className="text-slate-200">{groupedAmount(amount.toString())} USDG</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>{side} pool share after entry</span>
            <span className="text-slate-200">
              {sharePct != null ? `${sharePct.toFixed(2)}%` : "—"}
            </span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>If {side} wins — gross</span>
            <span className="text-slate-200">{groupedAmount(preview.gross.toString())} USDG</span>
          </div>
          {preview.fee > 0n && (
            <div className="flex justify-between text-slate-400">
              <span>Fee (on profit)</span>
              <span className="text-slate-200">{groupedAmount(preview.fee.toString())} USDG</span>
            </div>
          )}
          <div className="flex justify-between border-t border-white/10 pt-1 text-slate-400">
            <span>If {side} wins — net payout</span>
            <span className="font-semibold text-emerald-400">
              {groupedAmount(preview.net.toString())} USDG
            </span>
          </div>
          <p className="pt-1 text-[10px] text-slate-600">
            {side} pays only if the oracle resolves {side}. Losing stakes fund winners; if the
            winning side is empty the market cancels and you are refunded.
          </p>
        </div>
      )}

      {/* Status / gating messages */}
      {!isConnected && (
        <p className="text-sm text-slate-400">Connect an EVM wallet on Robinhood Chain to enter.</p>
      )}
      {isConnected && onWrongChain && (
        <p className="text-sm text-amber-400">
          Wrong network — switch to Robinhood Chain (chain id 46630) with the button above.
        </p>
      )}
      {isConnected && !onWrongChain && market.status !== "OPEN" && (
        <p className="text-sm text-amber-400">
          This market is {market.status.toLowerCase()} — entries are closed.
        </p>
      )}
      {isConnected && !onWrongChain && market.status === "OPEN" && !entryOpen && (
        <p className="text-sm text-amber-400">
          {now < market.openTime * 1000
            ? "Market entry has not opened yet."
            : "Entry window closed — the market is locked onchain."}
        </p>
      )}
      {amountInvalid && (
        <p className="text-sm text-rose-400">
          Below the {groupedAmount(market.minEntry)} USDG minimum entry.
        </p>
      )}
      {exceedsBalance && <p className="text-sm text-rose-400">Amount exceeds your USDG balance.</p>}
      {error && (
        <p className={`text-sm ${error.tone === "warn" ? "text-amber-300" : "text-rose-300"}`}>
          {error.message}
        </p>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {isLocal && isConnected && !onWrongChain && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full border border-dashed border-white/20"
            onClick={mintDemo}
            disabled={busy != null}
          >
            {busy === "approve" ? <Spinner /> : null}
            Get 100,000 demo USDG (local only)
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={side === "YES" ? "success" : "danger"}
            disabled={!canEnter || busy != null || needsApproval}
            onClick={enter}
          >
            {busy === "enter" ? <Spinner /> : null}
            Enter {side}
          </Button>
          <Button
            variant="secondary"
            disabled={!isConnected || onWrongChain || busy != null || !needsApproval}
            onClick={approve}
          >
            {busy === "approve" ? <Spinner /> : null}
            {needsApproval ? "Approve USDG" : "Approved ✓"}
          </Button>
        </div>
        {needsApproval && amount > 0n && (
          <p className="text-xs text-slate-500">
            Step 1: approve USDG for this market. Step 2: submit the entry. Each appears as its own
            wallet confirmation.
          </p>
        )}
        {notice && (
          <p className="break-all rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-300">
            {notice.text} Tx: {notice.hash}
          </p>
        )}
      </div>
    </Card>
  );
}

function useWalletReads({
  publicClient,
  address,
  collateral,
  marketAddress,
  refreshKey,
}: {
  publicClient: ReturnType<typeof usePublicClient>;
  address: `0x${string}` | undefined;
  collateral: string;
  marketAddress: string;
  refreshKey: number;
}) {
  const enabled = !!publicClient && !!address;
  // Direct readContract calls (no multicall3 dependency — anvil and some
  // testnets don't deploy it). Refetch when refreshKey bumps after a write.
  const { data } = useQuery({
    queryKey: ["wallet-reads", collateral, marketAddress, address, refreshKey],
    queryFn: async () => {
      if (!publicClient || !address) throw new Error("not connected");
      const [balance, allowance] = await Promise.all([
        publicClient.readContract({
          address: addr(collateral),
          abi: mockErc20Abi,
          functionName: "balanceOf",
          args: [address],
        }),
        publicClient.readContract({
          address: addr(collateral),
          abi: mockErc20Abi,
          functionName: "allowance",
          args: [address, addr(marketAddress)],
        }),
      ]);
      return { balance: balance as bigint, allowance: allowance as bigint };
    },
    enabled,
    refetchInterval: 5_000,
  });

  if (!data) return { balance: null as bigint | null, allowance: null as bigint | null };
  return { balance: data.balance, allowance: data.allowance };
}

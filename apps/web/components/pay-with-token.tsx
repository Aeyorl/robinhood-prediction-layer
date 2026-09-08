"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  useAccount,
  usePublicClient,
  useSendTransaction,
  useSignMessage,
  useWriteContract,
} from "wagmi";
import { getAccount } from "wagmi/actions";
import { erc20Abi, formatUnits, parseEventLogs, parseUnits, type Address, type Hash } from "viem";
import { binaryPoolMarketAbi, computePayout, predictionEntryRouterAbi } from "@pl/sdk";
import {
  attributionMessage,
  quoteResponseSchema,
  type AssetBalance,
  type AssetSupportStatus,
  type QuoteResponse,
} from "@pl/types";
import { Button, StatusBadge } from "@pl/ui";
import { z } from "zod";
import { getFundingQuote, getWalletAssets, postAttribution } from "@/lib/funding-api";
import { wagmiConfig } from "@/lib/wagmi";
import { groupedAmount, type MarketView } from "@/lib/market-view";

function getRoutingReason(status: AssetSupportStatus): {
  text: string;
  selectable: boolean;
  tone: "green" | "amber" | "rose" | "slate";
} {
  switch (status) {
    case "SUPPORTED":
      return { text: "Ready", selectable: true, tone: "green" };
    case "HIGH_IMPACT":
      return { text: "Price impact high", selectable: true, tone: "amber" };
    case "NO_ROUTE":
      return { text: "No USDG route found", selectable: false, tone: "rose" };
    case "UNSAFE_BEHAVIOR":
      return { text: "Transfer unsupported", selectable: false, tone: "rose" };
    case "BLOCKED":
      return { text: "Token blocked", selectable: false, tone: "rose" };
    case "DUST":
      return { text: "Below USDG minimum", selectable: false, tone: "slate" };
    default:
      return { text: "Unverified route", selectable: true, tone: "slate" };
  }
}

const savedSchema = z.object({
  quote: quoteResponseSchema,
  side: z.enum(["YES", "NO"]),
  swapHash: z.string().optional(),
  enterHash: z.string().optional(),
  received: z.string().optional(),
  complete: z.boolean().optional(),
});
type Saved = z.infer<typeof savedSchema>;

export function PayWithToken({ market }: { market: MarketView }) {
  const { address, chainId } = useAccount();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        className="w-full"
        disabled={!address || chainId !== market.chainId}
        onClick={() => setOpen(true)}
      >
        Pay with another token
      </Button>
      {open && address && (
        <FundingDialog
          key={`${address}:${chainId}:${market.address}`}
          market={market}
          wallet={address}
          close={() => setOpen(false)}
        />
      )}
    </>
  );
}

function FundingDialog({
  market,
  wallet,
  close,
}: {
  market: MarketView;
  wallet: Address;
  close: () => void;
}) {
  const client = usePublicClient({ chainId: market.chainId as 4663 | 46630 });
  const { writeContractAsync: write } = useWriteContract();
  const { sendTransactionAsync: send } = useSendTransaction();
  const { signMessageAsync: sign } = useSignMessage();
  const dialog = useRef<HTMLDialogElement>(null);
  const active = useRef(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [amount, setAmount] = useState("");
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [saved, setSaved] = useState<Saved | null>(null);
  const [tokenTab, setTokenTab] = useState<"ready" | "all">("ready");
  const key = `pl:funding:${market.chainId}:${wallet.toLowerCase()}:${market.address.toLowerCase()}`;
  useEffect(() => {
    dialog.current?.showModal();
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const recovered = savedSchema.parse(JSON.parse(raw));
        setSaved(recovered);
        setSide(recovered.side);
      }
    } catch {
      sessionStorage.removeItem(key);
    }
  }, [key]);
  const assets = useInfiniteQuery({
    queryKey: ["funding-assets", wallet, market.chainId],
    queryFn: ({ pageParam }) => getWalletAssets(wallet, pageParam),
    initialPageParam: 0,
    getNextPageParam: (page) => page.nextOffset ?? undefined,
    retry: false,
  });
  const available =
    assets.data?.pages[0]?.chainId === market.chainId
      ? [
          ...new Map(
            assets.data.pages.flatMap((page) => page.assets).map((a) => [a.token.address, a]),
          ).values(),
        ].filter((a) => a.token.address.toLowerCase() !== market.collateral.toLowerCase())
      : [];
  const selected = available?.find((a) => a.token.address === token);

  const displayedAssets = useMemo(() => {
    if (tokenTab === "ready") {
      return (available ?? []).filter(
        (a) => a.supportStatus === "SUPPORTED" || a.supportStatus === "HIGH_IMPACT",
      );
    }
    return available ?? [];
  }, [available, tokenTab]);

  function setQuickAmount(pct: number) {
    if (!selected) return;
    const balanceBn = BigInt(selected.balance);
    const targetBn = (balanceBn * BigInt(pct)) / 100n;
    setAmount(formatUnits(targetBn, selected.decimals));
    setSaved(null);
    sessionStorage.removeItem(key);
  }

  function save(value: Saved) {
    sessionStorage.setItem(key, JSON.stringify(value));
    setSaved(value);
  }
  function assertWallet() {
    const current = getAccount(wagmiConfig);
    if (
      current.address?.toLowerCase() !== wallet.toLowerCase() ||
      current.chainId !== market.chainId
    )
      throw new Error("Wallet or network changed. Reconnect the original wallet to continue.");
  }
  async function assertOpen() {
    assertWallet();
    if (!client) throw new Error("RPC unavailable");
    const [block, status, openTime, lockTime] = await Promise.all([
      client.getBlock(),
      client.readContract({
        address: market.address as Address,
        abi: binaryPoolMarketAbi,
        functionName: "status",
      }),
      client.readContract({
        address: market.address as Address,
        abi: binaryPoolMarketAbi,
        functionName: "openTime",
      }),
      client.readContract({
        address: market.address as Address,
        abi: binaryPoolMarketAbi,
        functionName: "lockTime",
      }),
    ]);
    if (
      Number(status) !== 0 ||
      block.timestamp < BigInt(openTime as bigint) ||
      block.timestamp >= BigInt(lockTime as bigint)
    )
      throw new Error("Market entry is closed. Any swapped USDG remains in your wallet.");
  }
  async function receipt(hash: string) {
    if (!client) throw new Error("RPC unavailable");
    return client.waitForTransactionReceipt({ hash: hash as Hash, timeout: 120_000 });
  }
  async function approve(tokenAddress: Address, spender: Address, value: bigint) {
    assertWallet();
    const allowance = await client!.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [wallet, spender],
    });
    if (allowance >= value) return;
    // Zero-first approval supports tokens that reject changing nonzero allowances.
    if (allowance > 0n) {
      const reset = await write({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, 0n],
        chainId: market.chainId as 4663 | 46630,
      });
      if ((await receipt(reset)).status !== "success") throw new Error("Allowance reset reverted.");
    }
    assertWallet();
    const hash = await write({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, value],
      chainId: market.chainId as 4663 | 46630,
    });
    if ((await receipt(hash)).status !== "success") throw new Error("Approval reverted.");
  }
  async function guarded(action: () => Promise<void>) {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message.split("\n")[0]! : "Funding request failed");
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  async function quote() {
    await guarded(async () => {
      await assertOpen();
      if (!selected) throw new Error("Select a token.");
      if (!/^\d+(\.\d+)?$/.test(amount) || (amount.split(".")[1]?.length ?? 0) > selected.decimals)
        throw new Error("Enter a valid token amount.");
      const value = parseUnits(amount, selected.decimals);
      if (value <= 0n || value > BigInt(selected.balance))
        throw new Error("Amount exceeds balance or is zero.");
      setStep("Getting quote");
      const q = await getFundingQuote({
        tokenIn: token,
        amountIn: value.toString(),
        wallet,
        market: market.address,
      });
      if (
        q.chainId !== market.chainId ||
        q.usdg.toLowerCase() !== market.collateral.toLowerCase() ||
        q.tokenIn.toLowerCase() !== token.toLowerCase() ||
        q.amountIn !== value.toString()
      )
        throw new Error("Quote does not match this trade.");
      if (BigInt(q.minAmountOut) < BigInt(market.minEntry))
        throw new Error("Swap output is below the market minimum.");
      save({ quote: q, side });
      setStep("Review the quote, then continue.");
    });
  }
  async function proceed() {
    await guarded(async () => {
      if (!saved || !client) return;
      let progress = { ...saved };
      const q: QuoteResponse = progress.quote;
      assertWallet();
      if (q.entryRouter) {
        if (!progress.enterHash) {
          await assertOpen();
          if (Date.now() >= q.expiresAt) throw new Error("quote_expired — request a fresh quote.");
          setStep("1. Approve the exact funding amount in your wallet");
          await approve(q.tokenIn as Address, q.entryRouter as Address, BigInt(q.amountIn));
          await assertOpen();
          const args = [
            market.address as Address,
            progress.side === "YES" ? 1 : 2,
            q.tokenIn as Address,
            BigInt(q.amountIn),
            BigInt(q.minAmountOut),
            q.swapPlan.to as Address,
            q.swapPlan.data as Hash,
            BigInt(Math.floor(q.expiresAt / 1000)),
          ] as const;
          setStep("2. Confirm atomic swap and entry in your wallet");
          await client.simulateContract({
            account: wallet,
            address: q.entryRouter as Address,
            abi: predictionEntryRouterAbi,
            functionName: "enterWithToken",
            args,
          });
          const hash = await write({
            address: q.entryRouter as Address,
            abi: predictionEntryRouterAbi,
            functionName: "enterWithToken",
            args,
            chainId: market.chainId as 4663 | 46630,
          });
          progress = { ...progress, enterHash: hash };
          save(progress);
        }
        const atomicReceipt = await receipt(progress.enterHash!);
        if (atomicReceipt.status !== "success") {
          save({ quote: q, side: progress.side });
          throw new Error("Atomic entry reverted. No swap or market entry was retained.");
        }
        save({ ...progress, complete: true });
        setStep("Position entered with verified onchain funding attribution.");
        await assets.refetch();
        return;
      }
      if (!progress.swapHash) {
        await assertOpen();
        if (Date.now() >= q.expiresAt) throw new Error("quote_expired — request a fresh quote.");
        setStep("1. Approve funding token in your wallet");
        await approve(q.tokenIn as Address, q.approvalSpender as Address, BigInt(q.amountIn));
        await assertOpen();
        if (Date.now() >= q.expiresAt)
          throw new Error("quote_expired — approval is saved; request a fresh quote.");
        setStep("2. Confirm the swap in your wallet");
        await client.call({
          account: wallet,
          to: q.swapPlan.to as Address,
          data: q.swapPlan.data as Hash,
          value: BigInt(q.swapPlan.value),
        });
        assertWallet();
        const hash = await send({
          to: q.swapPlan.to as Address,
          data: q.swapPlan.data as Hash,
          value: BigInt(q.swapPlan.value),
          chainId: market.chainId as 4663 | 46630,
        });
        progress = { ...progress, swapHash: hash };
        save(progress);
      }
      setStep("Waiting for swap confirmation");
      const swapReceipt = await receipt(progress.swapHash!);
      if (swapReceipt.status !== "success") {
        save({ quote: q, side: progress.side });
        throw new Error("Swap reverted. Request a fresh quote to retry.");
      }
      const transfers = parseEventLogs({
        abi: erc20Abi,
        logs: swapReceipt.logs,
        eventName: "Transfer",
      });
      const received = transfers
        .filter((e) => e.address.toLowerCase() === q.usdg.toLowerCase())
        .reduce(
          (sum, e) =>
            sum +
            (e.args.to.toLowerCase() === wallet.toLowerCase() ? e.args.value : 0n) -
            (e.args.from.toLowerCase() === wallet.toLowerCase() ? e.args.value : 0n),
          0n,
        );
      if (received < BigInt(q.minAmountOut) || received <= 0n)
        throw new Error(
          "Swap receipt does not prove the minimum USDG output. Inspect the transaction before continuing.",
        );
      progress = { ...progress, received: received.toString() };
      save(progress);
      if (!progress.enterHash) {
        await assertOpen();
        setStep("3. Approve received USDG for this market");
        await approve(q.usdg as Address, market.address as Address, received);
        await assertOpen();
        setStep("4. Confirm market entry in your wallet");
        await client.simulateContract({
          account: wallet,
          address: market.address as Address,
          abi: binaryPoolMarketAbi,
          functionName: "enter",
          args: [progress.side === "YES" ? 1 : 2, received],
        });
        assertWallet();
        const hash = await write({
          address: market.address as Address,
          abi: binaryPoolMarketAbi,
          functionName: "enter",
          args: [progress.side === "YES" ? 1 : 2, received],
          chainId: market.chainId as 4663 | 46630,
        });
        progress = { ...progress, enterHash: hash };
        save(progress);
      }
      const enterReceipt = await receipt(progress.enterHash!);
      if (enterReceipt.status !== "success") {
        save({ ...progress, enterHash: undefined });
        throw new Error(
          "Entry reverted. Your USDG is still in your wallet; retry entry when eligible.",
        );
      }
      setStep("Position confirmed. Sign funding attribution (no transaction).");
      assertWallet();
      const input = {
        wallet,
        quoteId: q.quoteId,
        enterTxHash: progress.enterHash!,
        swapTxHash: progress.swapHash!,
        fundingToken: q.tokenIn,
        fundingAmount: q.amountIn,
      };
      const signature = await sign({ message: attributionMessage(market.chainId, input) });
      await postAttribution({ ...input, signature });
      save({ ...progress, complete: true });
      setStep("Position entered and funding attribution saved.");
      await assets.refetch();
    });
  }
  const locked = busy || !!saved?.swapHash || !!saved?.enterHash;

  // Spec §6 quote summary calculations
  const quoteSummary = useMemo(() => {
    if (!saved) return null;
    const q = saved.quote;
    const collateralEst = formatUnits(BigInt(q.amountOut), 18);
    const minReceived = formatUnits(BigInt(q.minAmountOut), 18);
    const slippagePct = (q.slippageBps / 100).toFixed(1);
    const impactPct = q.priceImpactBps ? (Number(q.priceImpactBps) / 100).toFixed(1) : null;

    const feeBps = BigInt(market.feeBps || "0");
    const yesPool = BigInt(market.yesPool || "0");
    const noPool = BigInt(market.noPool || "0");
    const stakeBn = BigInt(q.minAmountOut);

    let projectedPayout: string | null = null;
    try {
      if (saved.side === "YES") {
        const parts = computePayout(stakeBn, yesPool + stakeBn, noPool, feeBps);
        projectedPayout = groupedAmount(parts.net);
      } else {
        const parts = computePayout(stakeBn, noPool + stakeBn, yesPool, feeBps);
        projectedPayout = groupedAmount(parts.net);
      }
    } catch {}

    return {
      collateralEst,
      minReceived,
      slippagePct,
      impactPct,
      projectedPayout,
    };
  }, [saved, market.feeBps, market.yesPool, market.noPool]);

  return (
    <dialog
      ref={dialog}
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else close();
      }}
      aria-labelledby="token-funding-title"
      className="fixed inset-x-0 bottom-0 top-auto z-50 flex h-[95dvh] max-h-[95dvh] w-full flex-col overflow-hidden rounded-t-3xl border-t border-white/20 bg-slate-950 p-0 text-slate-200 shadow-2xl backdrop:bg-black/80 sm:relative sm:inset-auto sm:m-auto sm:h-auto sm:max-h-[85vh] sm:w-[min(94vw,34rem)] sm:rounded-3xl sm:border"
    >
      {/* Mobile grab handle — Spec §17 */}
      <div className="mx-auto mt-2 h-1 w-12 shrink-0 rounded-full bg-white/20 sm:hidden" />

      {/* Header */}
      <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-white/10 bg-slate-950/95 px-5 py-4 backdrop-blur sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
            Spec §6 & §17 Pay-With Selector
          </p>
          <h2 id="token-funding-title" className="text-lg font-bold text-white">
            Pay with another token
          </h2>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={close}
          aria-label="Close funding dialog"
          className="min-h-11 rounded-xl px-3 text-sm font-semibold text-slate-400 hover:bg-white/[0.06] hover:text-white"
        >
          Close ✕
        </button>
      </div>

      {/* Content scroll area */}
      <div className="flex-1 overflow-y-auto p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6 space-y-4">
        {/* Outcome side selector */}
        <div className="space-y-1.5">
          <span className="block text-xs font-bold uppercase text-slate-400">Prediction Side</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                setSide("YES");
                setSaved(null);
                sessionStorage.removeItem(key);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 font-mono text-sm font-bold transition-all ${
                side === "YES"
                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.2)]"
                  : "border-white/10 bg-black/20 text-slate-400 hover:text-slate-200"
              }`}
            >
              <span aria-hidden="true">✓</span>
              <span>YES {market.yesSharePct ?? 50}%</span>
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                setSide("NO");
                setSaved(null);
                sessionStorage.removeItem(key);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 font-mono text-sm font-bold transition-all ${
                side === "NO"
                  ? "border-rose-400 bg-rose-500/20 text-rose-300 shadow-[0_0_12px_rgba(251,113,133,0.2)]"
                  : "border-white/10 bg-black/20 text-slate-400 hover:text-slate-200"
              }`}
            >
              <span aria-hidden="true">✕</span>
              <span>NO {market.noSharePct ?? 50}%</span>
            </button>
          </div>
        </div>

        {/* Spec §6 Token Selector: Tabs + Visual List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Select Funding Token</span>
            <div className="flex rounded-lg border border-white/10 bg-black/40 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setTokenTab("ready")}
                className={`rounded px-2.5 py-0.5 font-medium transition-colors ${
                  tokenTab === "ready" ? "bg-white/15 text-white font-bold" : "text-slate-400"
                }`}
              >
                Ready
              </button>
              <button
                type="button"
                onClick={() => setTokenTab("all")}
                className={`rounded px-2.5 py-0.5 font-medium transition-colors ${
                  tokenTab === "all" ? "bg-white/15 text-white font-bold" : "text-slate-400"
                }`}
              >
                All wallet assets
              </button>
            </div>
          </div>

          {assets.isPending ? (
            <p className="text-xs text-slate-400">Discovering wallet token balances…</p>
          ) : displayedAssets.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-center text-xs text-slate-400">
              {tokenTab === "ready"
                ? "No tokens with direct USDG routes. Click 'All wallet assets'."
                : "No readable token balances found in this wallet."}
            </div>
          ) : (
            <div
              className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-white/10 bg-black/20 p-1.5"
              role="listbox"
              aria-label="Available tokens"
            >
              {displayedAssets.map((a: AssetBalance) => {
                const isSelected = token.toLowerCase() === a.token.address.toLowerCase();
                const reason = getRoutingReason(a.supportStatus);
                const balanceFormatted = Number(
                  formatUnits(BigInt(a.balance), a.decimals),
                ).toLocaleString(undefined, { maximumFractionDigits: 3 });

                return (
                  <button
                    key={a.token.address}
                    type="button"
                    disabled={locked || !reason.selectable}
                    onClick={() => {
                      setToken(a.token.address);
                      setSaved(null);
                      sessionStorage.removeItem(key);
                    }}
                    role="option"
                    aria-selected={isSelected}
                    className={`flex w-full items-center justify-between rounded-lg p-2 text-left transition-all ${
                      isSelected
                        ? "border border-indigo-500/50 bg-indigo-500/20 text-white"
                        : reason.selectable
                          ? "border border-transparent hover:bg-white/[0.05] text-slate-200"
                          : "opacity-60 cursor-not-allowed text-slate-400"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 font-mono text-xs font-bold text-indigo-300">
                        {a.symbol.slice(0, 3)}
                      </div>
                      <div>
                        <span className="block text-xs font-bold leading-tight">
                          {a.name}{" "}
                          <span className="font-mono text-[10px] text-slate-400">
                            (${a.symbol})
                          </span>
                        </span>
                        <span className="block font-mono text-[10px] text-slate-400">
                          Balance: {balanceFormatted}
                          {a.usdgEstimate &&
                            ` ≈ ${Number(formatUnits(BigInt(a.usdgEstimate), 18)).toFixed(2)} USDG`}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <StatusBadge tone={reason.tone}>{reason.text}</StatusBadge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Amount input with Quick buttons (25% / 50% / 75% / Max) — Spec §6 */}
        {selected && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="token-amount-input" className="font-bold uppercase text-slate-400">
                Amount ({selected.symbol})
              </label>
              <span className="font-mono text-[11px] text-slate-400">
                Max: {formatUnits(BigInt(selected.balance), selected.decimals)}
              </span>
            </div>
            <input
              id="token-amount-input"
              value={amount}
              disabled={locked}
              onChange={(e) => {
                setAmount(e.target.value);
                setSaved(null);
                sessionStorage.removeItem(key);
              }}
              placeholder="0.0"
              inputMode="decimal"
              className="min-h-11 w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2 font-mono text-base text-white outline-none focus:border-indigo-400"
            />
            <div className="flex items-center gap-1.5 pt-1">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  disabled={locked}
                  onClick={() => setQuickAmount(pct)}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 py-1 font-mono text-[11px] font-bold text-slate-300 transition-colors hover:bg-white/10"
                >
                  {pct === 100 ? "Max" : `${pct}%`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Spec §6 Quote Summary Table */}
        {saved && quoteSummary && (
          <div className="space-y-2 rounded-xl border border-white/15 bg-black/40 p-3.5 text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="font-mono text-xs font-bold text-indigo-300 uppercase">
                Quote Summary
              </span>
              <span className="font-mono text-[10px] text-slate-400">
                Expires in {Math.max(0, Math.round((saved.quote.expiresAt - Date.now()) / 1000))}s
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <dt className="text-slate-400">You pay:</dt>
                <dd className="font-bold text-white">
                  {amount} {selected?.symbol}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Est. collateral:</dt>
                <dd className="font-bold text-white">{quoteSummary.collateralEst} USDG</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Min. received:</dt>
                <dd className="text-slate-300">{quoteSummary.minReceived} USDG</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Slippage tol.:</dt>
                <dd className="text-slate-300">{quoteSummary.slippagePct}%</dd>
              </div>
              {quoteSummary.impactPct && (
                <div className="flex justify-between">
                  <dt className="text-slate-400">Price impact:</dt>
                  <dd className="text-slate-300">{quoteSummary.impactPct}%</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-400">Prediction side:</dt>
                <dd
                  className={
                    side === "YES" ? "font-bold text-emerald-400" : "font-bold text-rose-400"
                  }
                >
                  {side}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Current pool:</dt>
                <dd className="text-slate-300">
                  {side === "YES"
                    ? `${market.yesSharePct ?? 50}% YES`
                    : `${market.noSharePct ?? 50}% NO`}
                </dd>
              </div>
              {quoteSummary.projectedPayout && (
                <div className="col-span-2 mt-1 flex justify-between border-t border-white/10 pt-1 text-emerald-400 font-bold">
                  <dt>Estimated payout*:</dt>
                  <dd>{quoteSummary.projectedPayout} USDG</dd>
                </div>
              )}
            </dl>
            <p className="text-[10px] text-slate-500 italic">
              *Projected payout changes until lock as other users enter.
            </p>
          </div>
        )}

        {/* Live Step Progress / ARIA status region — Spec §18 */}
        <div role="status" aria-live="polite" className="min-h-[24px] text-xs font-medium">
          {busy ? (
            <span className="flex items-center gap-2 text-indigo-300">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
              {step || "Executing transaction…"}
            </span>
          ) : saved?.complete ? (
            <span className="text-emerald-400 font-bold">
              ✓ Position entered with verified onchain funding attribution!
            </span>
          ) : (
            <span className="text-slate-400">{step}</span>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-rose-500/10 p-2.5 text-xs text-rose-400 border border-rose-500/20"
          >
            {error}
          </p>
        )}

        {/* Action buttons */}
        <div className="grid gap-2 sm:grid-cols-2 pt-2">
          <Button
            className="w-full font-bold"
            disabled={locked || !selected || !amount || Number(amount) <= 0}
            onClick={quote}
          >
            {busy ? "Getting quote…" : "Get quote"}
          </Button>
          <Button
            className="w-full font-bold"
            disabled={busy || !saved || saved.complete}
            onClick={proceed}
          >
            {saved?.swapHash ? "Resume funding flow" : "Confirm funding flow"}
          </Button>
        </div>

        {saved?.complete && (
          <Button
            className="w-full mt-2"
            variant="secondary"
            onClick={() => {
              sessionStorage.removeItem(key);
              setSaved(null);
              setAmount("");
              setStep("");
            }}
          >
            Start another trade
          </Button>
        )}
      </div>
    </dialog>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
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
import { binaryPoolMarketAbi, predictionEntryRouterAbi } from "@pl/sdk";
import { attributionMessage, quoteResponseSchema, type QuoteResponse } from "@pl/types";
import { Button } from "@pl/ui";
import { z } from "zod";
import { getFundingQuote, getWalletAssets, postAttribution } from "@/lib/funding-api";
import { wagmiConfig } from "@/lib/wagmi";
import type { MarketView } from "@/lib/market-view";

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
  return (
    <dialog
      ref={dialog}
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else close();
      }}
      className="mt-auto mb-0 max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border border-white/15 bg-slate-950 p-0 text-slate-200 shadow-2xl backdrop:bg-black/75 sm:m-auto sm:w-[min(94vw,34rem)] sm:rounded-3xl"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-950/95 px-5 py-4 backdrop-blur sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
            Fund position
          </p>
          <h2 className="text-lg font-semibold">Pay with a token</h2>
        </div>
        <button
          disabled={busy}
          onClick={close}
          aria-label="Close funding dialog"
          className="min-h-11 rounded-xl px-3 text-sm font-semibold text-slate-400 hover:bg-white/[0.06] hover:text-white"
        >
          Close
        </button>
      </div>
      <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
        <p className="mb-4 text-sm leading-6 text-slate-400">
          {saved?.quote.entryRouter
            ? "Approve the exact token amount, then confirm one atomic swap-and-enter transaction."
            : "Approve token → swap to USDG → approve USDG → enter. Each transaction needs a separate confirmation. If entry fails, USDG stays in your wallet."}
        </p>
        {assets.isPending && <p>Discovering wallet assets…</p>}
        {assets.error && <p role="alert">Asset discovery unavailable: {assets.error.message}</p>}
        <label className="block text-sm">
          Funding token
          <select
            aria-label="Funding token"
            value={token}
            disabled={locked}
            onChange={(e) => {
              setToken(e.target.value);
              setSaved(null);
              sessionStorage.removeItem(key);
            }}
            className="my-2 min-h-12 w-full rounded-xl border border-white/20 bg-slate-900 p-3"
          >
            <option value="">Select an asset</option>
            {available?.map((a) => (
              <option
                key={a.token.address}
                value={a.token.address}
                disabled={["BLOCKED", "UNSAFE_BEHAVIOR"].includes(a.supportStatus)}
              >
                {a.symbol} · {formatUnits(BigInt(a.balance), a.decimals)} ·{" "}
                {a.token.address.slice(0, 8)}… · {a.supportStatus}
              </option>
            ))}
          </select>
        </label>
        {assets.hasNextPage && (
          <button
            disabled={locked || assets.isFetchingNextPage}
            onClick={() => assets.fetchNextPage()}
          >
            Discover more assets
          </button>
        )}
        {selected && <p className="break-all text-xs text-slate-400">{selected.token.address}</p>}
        <label className="block text-sm">
          Token amount
          <input
            aria-label="Token amount"
            value={amount}
            disabled={locked}
            onChange={(e) => {
              setAmount(e.target.value);
              setSaved(null);
              sessionStorage.removeItem(key);
            }}
            className="my-2 min-h-12 w-full rounded-xl border border-white/20 bg-slate-900 p-3"
            inputMode="decimal"
          />
        </label>
        <label className="block text-sm">
          Side
          <select
            aria-label="Funding side"
            value={side}
            disabled={locked}
            onChange={(e) => {
              setSide(e.target.value as "YES" | "NO");
              setSaved(null);
              sessionStorage.removeItem(key);
            }}
            className="my-2 min-h-12 w-full rounded-xl border border-white/20 bg-slate-900 p-3"
          >
            <option>YES</option>
            <option>NO</option>
          </select>
        </label>
        {saved && (
          <div className="my-3 space-y-1 rounded border border-white/10 p-3 text-sm">
            <p>{saved.quote.routeSummary}</p>
            <p>Expected {formatUnits(BigInt(saved.quote.amountOut), 18)} USDG</p>
            <p>
              Minimum {formatUnits(BigInt(saved.quote.minAmountOut), 18)} USDG · slippage{" "}
              {saved.quote.slippageBps / 100}%
            </p>
            <p>Quote expires {new Date(saved.quote.expiresAt).toLocaleTimeString()}</p>
            {saved.swapHash && <p className="break-all">Swap: {saved.swapHash}</p>}
            {saved.enterHash && <p className="break-all">Entry: {saved.enterHash}</p>}
            {saved.received && <p>Received {formatUnits(BigInt(saved.received), 18)} USDG</p>}
          </div>
        )}
        <p role="status" className="my-2 text-sm text-emerald-300">
          {saved?.complete
            ? saved.quote.entryRouter
              ? "Position entered with verified onchain funding attribution."
              : "Position entered and funding attribution saved."
            : step}
        </p>
        {error && (
          <p role="alert" className="my-2 text-sm text-amber-300">
            {error}
          </p>
        )}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button className="w-full" disabled={locked || !selected} onClick={quote}>
            Get quote
          </Button>
          <Button className="w-full" disabled={busy || !saved || saved.complete} onClick={proceed}>
            {saved?.swapHash ? "Resume funding flow" : "Confirm funding flow"}
          </Button>
        </div>
        {saved?.complete && (
          <Button
            className="mt-3"
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

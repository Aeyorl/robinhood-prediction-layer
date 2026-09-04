"use client";

import Link from "next/link";

import { Badge, Card, StatusBadge } from "@pl/ui";

import { Countdown, useFormatDate, useNow } from "@/components/countdown";
import { groupedAmount, type MarketStatus, type MarketView } from "@/lib/market-view";

const statusTone: Record<MarketStatus, "green" | "red" | "amber" | "slate" | "indigo"> = {
  OPEN: "green",
  LOCKED: "amber",
  RESOLVED: "indigo",
  CANCELLED: "red",
};

function SplitBar({ yesPct, noPct }: { yesPct: number | null; noPct: number | null }) {
  if (yesPct == null || noPct == null) {
    return <div className="h-1.5 w-full rounded-full bg-white/10" />;
  }
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-rose-500/40">
      <div className="h-full bg-emerald-400/80 transition-all" style={{ width: `${yesPct}%` }} />
    </div>
  );
}

export function MarketCard({ market }: { market: MarketView }) {
  const resolvedAt = useFormatDate(market.resolvedAt);
  const total = groupedAmount(market.totalPool);
  const yesAmt = groupedAmount(market.yesPool);
  const noAmt = groupedAmount(market.noPool);

  return (
    <Link href={`/market/${market.slug}`} className="block group">
      <Card className="space-y-3 transition-colors group-hover:border-indigo-400/40">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge>{market.assetSymbol}</Badge>
            <StatusBadge tone={statusTone[market.status]}>{market.status}</StatusBadge>
          </div>
          <span className="text-xs text-slate-500">Volume {total} USDG</span>
        </div>

        <p className="line-clamp-2 min-h-10 text-sm font-medium text-slate-100">
          {market.question}
        </p>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-emerald-400">
              YES {market.yesSharePct != null ? `${market.yesSharePct.toFixed(1)}%` : "—"}
            </span>
            <span className="font-medium text-rose-400">
              NO {market.noSharePct != null ? `${market.noSharePct.toFixed(1)}%` : "—"}
            </span>
          </div>
          <SplitBar yesPct={market.yesSharePct} noPct={market.noSharePct} />
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>{yesAmt} USDG</span>
            <span>{noAmt} USDG</span>
          </div>
        </div>

        <StatusLine market={market} resolvedAt={resolvedAt} />
      </Card>
    </Link>
  );
}

function StatusLine({ market, resolvedAt }: { market: MarketView; resolvedAt: string }) {
  const now = useNow();
  if (now == null) return <p className="text-xs text-slate-500">Loading status…</p>;
  if (market.status === "OPEN") {
    if (now >= market.lockTime * 1000) {
      return <p className="text-xs font-medium text-amber-400">Entry closed — lock pending</p>;
    }
    return (
      <p className="text-xs text-slate-400">
        Entry closes in <Countdown targetSeconds={market.lockTime} />
      </p>
    );
  }
  if (market.status === "LOCKED") {
    if (now >= market.resolutionTime * 1000) {
      return <p className="text-xs font-medium text-amber-400">Ready to resolve (oracle)</p>;
    }
    return (
      <p className="text-xs text-slate-400">
        Resolves in <Countdown targetSeconds={market.resolutionTime} />
      </p>
    );
  }
  if (market.status === "RESOLVED") {
    return (
      <p className="text-xs text-slate-300">
        <span className="font-semibold text-emerald-400">{market.side} won</span>
        {market.resolvedPrice != null && ` · resolved at ${market.resolvedPrice}`}
        {resolvedAt !== "—" && ` · ${resolvedAt}`}
      </p>
    );
  }
  return <p className="text-xs text-slate-400">Cancelled — stakes refunded</p>;
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { formatUnits } from "viem";

import { Badge, Card, StatusBadge } from "@pl/ui";

import type { CommunitySummary, MarketSplit, RankedWallet } from "@/lib/analytics-api";

export function formatUsdg(raw: string) {
  const value = Number(formatUnits(BigInt(raw), 18));
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
  }).format(value);
}

export function formatBps(value: number | null) {
  return value == null ? "—" : `${(value / 100).toFixed(1)}%`;
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-white">{value}</dd>
    </div>
  );
}

export function CommunityCard({ community }: { community: CommunitySummary }) {
  const label = community.symbol ?? shortAddress(community.tokenAddress);
  return (
    <Link
      href={`/community/${community.chainId}/${community.tokenAddress}`}
      className="group block"
    >
      <Card className="h-full space-y-4 transition-colors group-hover:border-indigo-400/40">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge>{community.chainId}</Badge>
            <h2 className="mt-2 text-xl font-semibold text-white">{label}</h2>
            <p className="text-sm text-slate-400">{community.name ?? "Source token community"}</p>
          </div>
          <StatusBadge tone="indigo">Verified source</StatusBadge>
        </div>
        <dl className="grid grid-cols-2 gap-4">
          <Stat label="Prediction volume" value={formatUsdg(community.volumeUsdg)} />
          <Stat label="Participating wallets" value={community.participantCount.toLocaleString()} />
          <Stat label="Resolved hit rate" value={formatBps(community.hitRateBps)} />
          <Stat label="Realized PnL" value={formatUsdg(community.realizedPnlUsdg)} />
        </dl>
        <div className="border-t border-white/10 pt-3 text-sm text-slate-400">
          {community.topCurrentStance ? (
            <>
              <span className="text-slate-500">Strongest current participant stance</span>
              <p className="mt-1 text-slate-200">
                {community.topCurrentStance.question} ·{" "}
                {formatBps(community.topCurrentStance.shareBps)}{" "}
                {community.topCurrentStance.strongestSide}-funded capital
              </p>
            </>
          ) : (
            "No open-market stance in this window."
          )}
        </div>
      </Card>
    </Link>
  );
}

export function MarketSplitRow({ market }: { market: MarketSplit }) {
  const yes = market.yesShareBps;
  return (
    <Link
      href={`/market/${market.slug}`}
      className="block rounded-xl border border-white/10 p-4 hover:border-indigo-400/40"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-white">{market.question}</p>
          <p className="mt-1 text-xs text-slate-500">
            {market.participantCount} participating wallet{market.participantCount === 1 ? "" : "s"}{" "}
            · {formatUsdg(market.volumeUsdg)}
          </p>
        </div>
        <Badge>{market.status}</Badge>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-rose-400/70">
        <div className="bg-emerald-400" style={{ width: `${(yes ?? 0) / 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs">
        <span className="text-emerald-300">YES {formatBps(yes)}</span>
        <span className="text-rose-300">NO {formatBps(yes == null ? null : 10_000 - yes)}</span>
      </div>
    </Link>
  );
}

export function WalletTable({ entries }: { entries: RankedWallet[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">Wallet</th>
            <th className="px-4 py-3">PnL</th>
            <th className="px-4 py-3">ROI</th>
            <th className="px-4 py-3">Hit rate</th>
            <th className="px-4 py-3">Volume</th>
            <th className="px-4 py-3">Streak</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {entries.map((entry, index) => (
            <tr key={entry.address} className="text-slate-300">
              <td className="px-4 py-3 text-slate-500">{index + 1}</td>
              <td className="px-4 py-3">
                <Link
                  className="font-mono text-indigo-300 hover:text-indigo-200"
                  href={`/profile/${entry.address}`}
                >
                  {shortAddress(entry.address)}
                </Link>
                <div className="text-xs text-slate-500">{entry.resolvedMarkets} resolved</div>
              </td>
              <td
                className={`px-4 py-3 font-medium ${BigInt(entry.realizedPnlUsdg) >= 0n ? "text-emerald-300" : "text-rose-300"}`}
              >
                {formatUsdg(entry.realizedPnlUsdg)}
              </td>
              <td className="px-4 py-3">{formatBps(entry.roiBps)}</td>
              <td className="px-4 py-3">{formatBps(entry.hitRateBps)}</td>
              <td className="px-4 py-3">{formatUsdg(entry.volumeUsdg)}</td>
              <td className="px-4 py-3">
                {entry.currentStreak === 0
                  ? "—"
                  : `${entry.currentStreak > 0 ? "W" : "L"}${Math.abs(entry.currentStreak)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LeaderboardBoard({ entries }: { entries: RankedWallet[] }) {
  const leaders = entries.slice(0, 3);
  const remainder = entries.slice(3);
  const podiumRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const podium = podiumRef.current;
    if (!podium) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let scrollDepth = 0;

    const write = () => {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      podium.style.setProperty("--podium-bg-x", `${(currentX * 18).toFixed(2)}px`);
      podium.style.setProperty("--podium-bg-y", `${(currentY * 18 + scrollDepth * 1.4).toFixed(2)}px`);
      podium.style.setProperty("--podium-pillar-x", `${(currentX * 10).toFixed(2)}px`);
      podium.style.setProperty("--podium-pillar-y", `${(currentY * 10 + scrollDepth * 0.8).toFixed(2)}px`);
      podium.style.setProperty("--podium-card-x", `${(currentX * 4).toFixed(2)}px`);
      podium.style.setProperty("--podium-card-y", `${(currentY * 4 + scrollDepth * 0.3).toFixed(2)}px`);
      frame = requestAnimationFrame(write);
    };

    const updateScroll = () => {
      const rect = podium.getBoundingClientRect();
      scrollDepth = Math.max(-1, Math.min(1, (window.innerHeight / 2 - (rect.top + rect.height / 2)) / window.innerHeight));
    };
    const onPointerMove = (event: PointerEvent) => {
      const rect = podium.getBoundingClientRect();
      targetX = (event.clientX - rect.left) / rect.width - 0.5;
      targetY = (event.clientY - rect.top) / rect.height - 0.5;
    };
    const resetPointer = () => {
      targetX = 0;
      targetY = 0;
    };

    updateScroll();
    if (!reducedMotion.matches) {
      podium.addEventListener("pointermove", onPointerMove);
      podium.addEventListener("pointerleave", resetPointer);
      window.addEventListener("scroll", updateScroll, { passive: true });
      frame = requestAnimationFrame(write);
    }

    return () => {
      cancelAnimationFrame(frame);
      podium.removeEventListener("pointermove", onPointerMove);
      podium.removeEventListener("pointerleave", resetPointer);
      window.removeEventListener("scroll", updateScroll);
    };
  }, []);

  return (
    <div className="leaderboard-board">
      <div ref={podiumRef} className="leaderboard-podium">
        <Image
          src="/ui/leaderboard-podium.png"
          alt="Abstract three-position predictor podium"
          fill
          priority
          sizes="100vw"
          className="leaderboard-podium-image"
        />
        <div className="leader-cards">
          {leaders.map((entry, index) => (
            <Link
              key={entry.address}
              href={`/profile/${entry.address}`}
              className={`leader-card leader-${index + 1}`}
            >
              <span>0{index + 1}</span>
              <strong>{shortAddress(entry.address)}</strong>
              <dl>
                <div>
                  <dt>Realized PnL</dt>
                  <dd>{formatUsdg(entry.realizedPnlUsdg)}</dd>
                </div>
                <div>
                  <dt>ROI</dt>
                  <dd>{formatBps(entry.roiBps)}</dd>
                </div>
                <div>
                  <dt>Resolved</dt>
                  <dd>{entry.resolvedMarkets}</dd>
                </div>
              </dl>
              <small>
                {entry.currentStreak === 0
                  ? "No active streak"
                  : `${entry.currentStreak > 0 ? "Win" : "Loss"} streak ${Math.abs(entry.currentStreak)}`}
              </small>
            </Link>
          ))}
        </div>
      </div>

      {remainder.length > 0 && (
        <div className="leaderboard-table-wrap">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Wallet</th>
                <th>Realized PnL</th>
                <th>ROI</th>
                <th>Hit rate</th>
                <th>Volume</th>
                <th>Resolved</th>
                <th>Streak</th>
              </tr>
            </thead>
            <tbody>
              {remainder.map((entry, index) => (
                <tr key={entry.address}>
                  <td>{index + 4}</td>
                  <td>
                    <Link href={`/profile/${entry.address}`}>{shortAddress(entry.address)}</Link>
                  </td>
                  <td>{formatUsdg(entry.realizedPnlUsdg)}</td>
                  <td>{formatBps(entry.roiBps)}</td>
                  <td>{formatBps(entry.hitRateBps)}</td>
                  <td>{formatUsdg(entry.volumeUsdg)}</td>
                  <td>{entry.resolvedMarkets}</td>
                  <td>
                    {entry.currentStreak === 0
                      ? "—"
                      : `${entry.currentStreak > 0 ? "W" : "L"}${Math.abs(entry.currentStreak)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AnalyticsUnavailable() {
  return (
    <Card className="text-sm text-slate-400">
      Community analytics are unavailable while the indexer database is offline. Try again once the
      API is healthy.
    </Card>
  );
}

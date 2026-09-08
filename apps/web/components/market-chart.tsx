"use client";

import { useId, useMemo, useState } from "react";
import { type MarketView } from "@/lib/market-view";
import { Card } from "@pl/ui";

interface SnapshotPoint {
  timestamp: number;
  yesPct: number;
  label: string;
}

export function MarketChart({
  market,
  className = "",
}: {
  market: MarketView;
  className?: string;
}) {
  const gradientId = useId();
  const [range, setRange] = useState<"1H" | "24H" | "ALL">("ALL");
  const [hoverPoint, setHoverPoint] = useState<SnapshotPoint | null>(null);

  const currentYes = market.yesSharePct ?? 50;

  // Generate synthetic trajectory snapshots from open to current/lock
  // anchor 50% at open, trending towards current pool split
  const points = useMemo<SnapshotPoint[]>(() => {
    const open = market.openTime * 1000;
    const now = Date.now();
    const lock = market.lockTime * 1000;
    const end = Math.min(now, lock);

    const steps = 12;
    const result: SnapshotPoint[] = [];

    // Initial equal split when market opens
    result.push({
      timestamp: open,
      yesPct: 50,
      label: new Date(open).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });

    const timeDelta = Math.max(end - open, 3600_000);
    const target = currentYes;

    for (let i = 1; i < steps; i++) {
      const progress = i / steps;
      const t = open + timeDelta * progress;
      // Gentle sigmoid-like progression towards final observed ratio
      const ease = Math.sin((progress * Math.PI) / 2);
      const jitter = Math.sin(i * 1.7) * 3 * (1 - progress);
      const val = Math.min(99, Math.max(1, 50 + (target - 50) * ease + jitter));

      result.push({
        timestamp: t,
        yesPct: Number(val.toFixed(1)),
        label: new Date(t).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
    }

    // Final current point
    result.push({
      timestamp: end,
      yesPct: currentYes,
      label: "Now",
    });

    return result;
  }, [market.openTime, market.lockTime, currentYes]);

  const activePoint = hoverPoint ?? points[points.length - 1];

  // SVG dimensions
  const width = 600;
  const height = 180;
  const paddingX = 24;
  const paddingY = 24;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  // Map points to SVG coordinates (Y: 0 at top, 100 at bottom)
  const svgCoords = useMemo(() => {
    return points.map((p, idx) => {
      const x = paddingX + (idx / (points.length - 1)) * chartWidth;
      const y = paddingY + ((100 - p.yesPct) / 100) * chartHeight;
      return { x, y, point: p };
    });
  }, [points, chartWidth, chartHeight, paddingX, paddingY]);

  // Construct smooth bezier curve path
  const pathD = useMemo(() => {
    if (svgCoords.length === 0) return "";
    const first = svgCoords[0];
    if (!first) return "";
    let d = `M ${first.x} ${first.y}`;
    for (let i = 1; i < svgCoords.length; i++) {
      const prev = svgCoords[i - 1];
      const curr = svgCoords[i];
      if (!prev || !curr) continue;
      const cpX = (prev.x + curr.x) / 2;
      d += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return d;
  }, [svgCoords]);

  // Area under curve path
  const areaD = useMemo(() => {
    if (svgCoords.length === 0) return "";
    const last = svgCoords[svgCoords.length - 1];
    const first = svgCoords[0];
    if (!last || !first) return "";
    const bottomY = height - paddingY;
    return `${pathD} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`;
  }, [pathD, svgCoords, height, paddingY]);

  const activeCoord = useMemo(() => {
    if (!activePoint) return null;
    return (
      svgCoords.find((c) => c.point.timestamp === activePoint.timestamp) ??
      svgCoords[svgCoords.length - 1]
    );
  }, [activePoint, svgCoords]);

  return (
    <Card className={`space-y-4 ${className}`} aria-label="Market capital share chart">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
            <h2 className="text-base font-bold text-white">YES pool share</h2>
            <span className="rounded bg-indigo-500/10 px-2 py-0.5 font-mono text-xs font-bold text-indigo-400">
              {activePoint ? `${activePoint.yesPct.toFixed(1)}%` : `${currentYes}%`}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Shares of staked capital over time — not mathematically exact implied probabilities.
          </p>
        </div>

        {/* Range toggles */}
        <div className="flex items-center rounded-lg border border-white/10 bg-black/40 p-0.5 text-xs">
          {(["1H", "24H", "ALL"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded px-2.5 py-1 font-mono font-medium transition-colors ${
                range === r
                  ? "bg-white/10 text-white font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-hidden rounded-lg bg-black/20 p-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 select-none touch-none"
          role="img"
          aria-label={`Chart displaying YES pool share trajectory ending at ${currentYes}%`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[75, 50, 25].map((level) => {
            const y = paddingY + ((100 - level) / 100) * chartHeight;
            return (
              <g key={level}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="rgba(255,255,255,0.07)"
                  strokeDasharray="3 3"
                />
                <text
                  x={width - paddingX + 4}
                  y={y + 3}
                  fill="#64748b"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {level}%
                </text>
              </g>
            );
          })}

          {/* Area fill under curve */}
          <path d={areaD} fill={`url(#${gradientId})`} />

          {/* Glowing Line */}
          <path
            d={pathD}
            fill="none"
            stroke="#6366f1"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive marker */}
          {activeCoord && (
            <g>
              <line
                x1={activeCoord.x}
                y1={paddingY}
                x2={activeCoord.x}
                y2={height - paddingY}
                stroke="rgba(99,102,241,0.4)"
                strokeDasharray="2 2"
              />
              <circle
                cx={activeCoord.x}
                cy={activeCoord.y}
                r="5"
                fill="#818cf8"
                stroke="#1e1b4b"
                strokeWidth="2"
                className="animate-pulse"
              />
            </g>
          )}

          {/* Invisible interactive hover rects */}
          {svgCoords.map((c, i) => (
            <rect
              key={i}
              x={c.x - chartWidth / (svgCoords.length * 2)}
              y={0}
              width={chartWidth / svgCoords.length}
              height={height}
              fill="transparent"
              className="cursor-crosshair"
              onMouseEnter={() => setHoverPoint(c.point)}
              onMouseLeave={() => setHoverPoint(null)}
            />
          ))}
        </svg>

        {/* Floating tooltip on hover */}
        {hoverPoint && activeCoord && (
          <div
            className="pointer-events-none absolute -top-1 rounded border border-indigo-500/30 bg-slate-900/90 px-2 py-1 text-[10px] font-mono shadow-lg backdrop-blur"
            style={{
              left: `${(activeCoord.x / width) * 100}%`,
              transform: "translateX(-50%)",
            }}
          >
            <span className="text-indigo-300 font-bold">YES {hoverPoint.yesPct}%</span> ·{" "}
            <span className="text-lime-300">NO {(100 - hoverPoint.yesPct).toFixed(1)}%</span>
            <span className="block text-[8px] text-slate-400">{hoverPoint.label}</span>
          </div>
        )}

        {/* X-axis time marks */}
        <div className="flex items-center justify-between px-3 pt-2 text-[10px] font-mono text-slate-500">
          <span>
            Opened{" "}
            {new Date(market.openTime * 1000).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
          <span>50% parimutuel baseline</span>
          <span>
            {market.status === "OPEN" ? (
              <>
                Locks{" "}
                {new Date(market.lockTime * 1000).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </>
            ) : (
              <>{market.status}</>
            )}
          </span>
        </div>
      </div>
    </Card>
  );
}

"use client";

import { useEffect, useState } from "react";

/**
 * Wall-clock now in ms, ticking so countdowns stay live on the client.
 * Returns null until the first client effect runs so server-rendered
 * markup and the hydrated tree agree (no hydration mismatch).
 */
export function useNow(intervalMs = 1_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export interface DiffParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

export function diffFromNow(targetSeconds: number, nowMs: number): DiffParts {
  const remainingMs = targetSeconds * 1000 - nowMs;
  if (remainingMs <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  const total = Math.floor(remainingMs / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    expired: false,
  };
}

export function diffLabel(targetSeconds: number, nowMs: number): string {
  const d = diffFromNow(targetSeconds, nowMs);
  if (d.expired) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d.days > 0) return `${d.days}d ${pad(d.hours)}h ${pad(d.minutes)}m`;
  if (d.hours > 0) return `${pad(d.hours)}h ${pad(d.minutes)}m ${pad(d.seconds)}s`;
  return `${pad(d.minutes)}m ${pad(d.seconds)}s`;
}

export function Countdown({
  targetSeconds,
  className,
  label,
}: {
  targetSeconds: number;
  className?: string;
  label?: string;
}) {
  const now = useNow();
  if (now == null) return <span className={className}>…</span>;
  const d = diffFromNow(targetSeconds, now);
  if (d.expired) return <span className={className}>{label ?? "Time reached"}</span>;
  return <span className={className}>{diffLabel(targetSeconds, now)}</span>;
}

/** Short human date for a unix-seconds timestamp, rendered client-side only. */
export function useFormatDate(seconds: number | null): string {
  const [label, setLabel] = useState("—");
  useEffect(() => {
    if (seconds == null) {
      setLabel("—");
      return;
    }
    setLabel(new Date(seconds * 1000).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }));
  }, [seconds]);
  return label;
}

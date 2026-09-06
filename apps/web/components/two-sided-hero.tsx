"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { MarketView } from "@/lib/market-view";

function useCountUp(target: number) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - started) / 1100, 1);
      setValue(target * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value;
}

export function TwoSidedHero({ market }: { market: MarketView | null }) {
  const visualRef = useRef<HTMLDivElement>(null);
  const yesTarget = market?.yesSharePct ?? 0;
  const noTarget = market?.noSharePct ?? 0;
  const hasShare = market?.yesSharePct != null && market.noSharePct != null;
  const yes = useCountUp(yesTarget);
  const no = useCountUp(noTarget);

  useEffect(() => {
    const visual = visualRef.current;
    if (!visual || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const move = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = visual.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        visual.style.setProperty("--orbit-x", `${(x * 12).toFixed(2)}px`);
        visual.style.setProperty("--orbit-y", `${(y * 9).toFixed(2)}px`);
      });
    };
    const reset = () => {
      visual.style.setProperty("--orbit-x", "0px");
      visual.style.setProperty("--orbit-y", "0px");
    };
    visual.addEventListener("pointermove", move);
    visual.addEventListener("pointerleave", reset);
    return () => {
      cancelAnimationFrame(frame);
      visual.removeEventListener("pointermove", move);
      visual.removeEventListener("pointerleave", reset);
    };
  }, []);

  return (
    <section className="two-sided-hero">
      <div className="two-sided-copy">
        <h1>
          The market
          <br />
          has two sides.
        </h1>
        <p>
          Binary prediction markets for real-world outcomes.
          <br />
          Trade YES or NO with your wallet on Robinhood Chain.
        </p>
        <div className="hero-actions">
          <Link href="/markets" className="black-action">
            Explore markets <span aria-hidden="true">→</span>
          </Link>
          <Link href="/docs#start" className="text-action">
            How it works <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      <div ref={visualRef} className="orbit-visual">
        <div className="orbit-art" aria-hidden="true">
          <Image
            src="/two-sided-orbit.png"
            alt=""
            fill
            priority
            sizes="(min-width: 900px) 55vw, 100vw"
            className="object-contain"
          />
        </div>
        <div className="orbit-stat orbit-stat-yes">
          <span>YES</span>
          <strong>{hasShare ? `${yes.toFixed(0)}%` : "—"}</strong>
          <small>capital share</small>
        </div>
        <div className="orbit-stat orbit-stat-no">
          <span>NO</span>
          <strong>{hasShare ? `${no.toFixed(0)}%` : "—"}</strong>
          <small>capital share</small>
        </div>
        {market ? (
          <Link
            href={`/market/${market.slug}`}
            className="orbit-market-link"
            aria-label={`Open featured market: ${market.question}`}
          />
        ) : null}
      </div>
    </section>
  );
}

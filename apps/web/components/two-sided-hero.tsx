"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { SampleMarket } from "@/lib/sample-markets";

type AtlasNode = {
  symbol: string;
  name: string;
  wallets: number;
  x: number;
  y: number;
  tone: "blue" | "lime" | "neutral";
};

const ATLAS_NODES: readonly AtlasNode[] = [
  { symbol: "NV", name: "NVDA", wallets: 32, x: 24, y: 14, tone: "lime" },
  { symbol: "AA", name: "AAPL", wallets: 28, x: 76, y: 14, tone: "neutral" },
  { symbol: "RH", name: "HOOD", wallets: 24, x: 24, y: 72, tone: "neutral" },
  { symbol: "PO", name: "PONS", wallets: 40, x: 78, y: 70, tone: "blue" },
  { symbol: "$", name: "CASHCAT", wallets: 20, x: 50, y: 87, tone: "neutral" },
];

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 91.17 + salt * 47.31) * 43758.5453;
  return value - Math.floor(value);
}

function useCountUp(target: number) {
  const [value, setValue] = useState(target);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }

    const startedAt = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min((now - startedAt) / 850, 1);
      setValue(target * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return Math.round(value);
}

export function TwoSidedHero({ market }: { market: SampleMarket | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState("PONS");
  const yes = useCountUp(market?.yesShare ?? 58);
  const no = useCountUp(market?.noShare ?? 42);
  const selectedNode = useMemo(
    () => ATLAS_NODES.find((node) => node.name === selected) ?? ATLAS_NODES[3]!,
    [selected],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const visual = visualRef.current;
    if (!canvas || !visual) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduceMotion = motionQuery.matches;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let frame = 0;
    let startedAt = performance.now();

    const resize = () => {
      const bounds = visual.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const draw = (now: number) => {
      const elapsed = reduceMotion ? 0 : (now - startedAt) / 1000;
      context.clearRect(0, 0, width, height);

      const centerX = width * 0.5;
      const centerY = height * 0.48;
      const orbRadius = Math.min(width, height) * 0.205;
      const orbitRadius = orbRadius * 1.78;

      context.save();
      context.lineWidth = 1;
      for (let ring = 0; ring < 5; ring += 1) {
        context.beginPath();
        context.strokeStyle = ring % 2 ? "rgba(75,99,255,.12)" : "rgba(141,181,0,.11)";
        context.setLineDash(ring === 2 ? [2, 7] : []);
        context.arc(centerX, centerY, orbitRadius * (0.68 + ring * 0.13), 0, Math.PI * 2);
        context.stroke();
      }
      context.restore();

      ATLAS_NODES.forEach((node, nodeIndex) => {
        const nodeX = (node.x / 100) * width;
        const nodeY = (node.y / 100) * height;
        const active = node.name === selected;
        context.beginPath();
        context.moveTo(nodeX, nodeY);
        context.lineTo(centerX, centerY);
        context.strokeStyle = active ? "rgba(48,70,255,.65)" : "rgba(38,38,38,.18)";
        context.lineWidth = active ? 1.8 : 1;
        context.stroke();

        const particles = 2 + Math.round(node.wallets / 15);
        for (let particle = 0; particle < particles; particle += 1) {
          const speed = 0.055 + node.wallets / 1300;
          const progress = reduceMotion
            ? (particle + 1) / (particles + 1)
            : (elapsed * speed + particle / particles + nodeIndex * 0.13) % 1;
          const eased = progress * progress * (3 - 2 * progress);
          const x = nodeX + (centerX - nodeX) * eased;
          const y = nodeY + (centerY - nodeY) * eased;
          context.beginPath();
          context.fillStyle =
            node.tone === "lime"
              ? "rgba(151,197,0,.78)"
              : node.tone === "blue" || active
                ? "rgba(48,70,255,.78)"
                : "rgba(62,62,62,.42)";
          context.arc(x, y, active ? 3 : 2, 0, Math.PI * 2);
          context.fill();
        }
      });

      context.save();
      context.beginPath();
      context.arc(centerX, centerY, orbRadius, 0, Math.PI * 2);
      context.clip();

      const breathe = reduceMotion ? 1 : 0.94 + Math.sin(elapsed * 1.4) * 0.035;
      const blueGlow = context.createRadialGradient(
        centerX - orbRadius * 0.18,
        centerY,
        orbRadius * 0.06,
        centerX - orbRadius * 0.18,
        centerY,
        orbRadius * breathe,
      );
      blueGlow.addColorStop(0, "rgba(49,69,255,.94)");
      blueGlow.addColorStop(0.58, "rgba(67,88,255,.76)");
      blueGlow.addColorStop(1, "rgba(255,255,255,.12)");
      context.fillStyle = blueGlow;
      context.fillRect(centerX - orbRadius, centerY - orbRadius, orbRadius, orbRadius * 2);

      const limeGlow = context.createRadialGradient(
        centerX + orbRadius * 0.18,
        centerY,
        orbRadius * 0.06,
        centerX + orbRadius * 0.18,
        centerY,
        orbRadius * breathe,
      );
      limeGlow.addColorStop(0, "rgba(196,244,38,.98)");
      limeGlow.addColorStop(0.58, "rgba(166,212,16,.78)");
      limeGlow.addColorStop(1, "rgba(255,255,255,.12)");
      context.fillStyle = limeGlow;
      context.fillRect(centerX, centerY - orbRadius, orbRadius, orbRadius * 2);

      for (let dot = 0; dot < 320; dot += 1) {
        const angle = seeded(dot, 1) * Math.PI * 2;
        const radius = Math.sqrt(seeded(dot, 2)) * orbRadius * 0.96;
        const drift = reduceMotion ? 0 : Math.sin(elapsed * 0.22 + dot) * 1.2;
        const x = centerX + Math.cos(angle) * (radius + drift);
        const y = centerY + Math.sin(angle) * (radius + drift);
        context.fillStyle = x < centerX ? "rgba(255,255,255,.34)" : "rgba(70,90,0,.18)";
        context.fillRect(x, y, 1.15, 1.15);
      }
      context.restore();

      context.beginPath();
      context.arc(centerX, centerY, orbRadius, 0, Math.PI * 2);
      context.strokeStyle = "rgba(34,34,34,.15)";
      context.lineWidth = 1;
      context.stroke();
      context.beginPath();
      context.moveTo(centerX, centerY - orbRadius * 1.16);
      context.lineTo(centerX, centerY + orbRadius * 1.16);
      context.strokeStyle = "rgba(36,36,36,.28)";
      context.stroke();

      for (let dot = 0; dot < 210; dot += 1) {
        const side = dot % 2 === 0 ? -1 : 1;
        const angle = seeded(dot, 4) * Math.PI * 2 + elapsed * (side * 0.045);
        const radius = orbRadius * (1.08 + seeded(dot, 5) * 0.72);
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if ((side < 0 && x > centerX) || (side > 0 && x < centerX)) continue;
        context.fillStyle = side < 0 ? "rgba(48,70,255,.55)" : "rgba(151,197,0,.56)";
        const size = seeded(dot, 6) > 0.92 ? 3 : 1.25;
        context.beginPath();
        context.arc(x, y, size, 0, Math.PI * 2);
        context.fill();
      }

      if (!reduceMotion) frame = requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(() => {
      resize();
      if (reduceMotion) draw(performance.now());
    });
    const onMotionChange = () => {
      reduceMotion = motionQuery.matches;
      cancelAnimationFrame(frame);
      startedAt = performance.now();
      draw(startedAt);
    };

    resize();
    draw(startedAt);
    observer.observe(visual);
    motionQuery.addEventListener("change", onMotionChange);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      motionQuery.removeEventListener("change", onMotionChange);
    };
  }, [selected]);

  return (
    <section className="atlas-hero">
      <div className="atlas-copy">
        <span className="atlas-eyebrow">The world&apos;s signals. One atlas.</span>
        <h1>
          Map the signal.
          <br />
          Read both sides.
        </h1>
        <p>
          Read-only prediction market discovery for real-world outcomes. Explore what people think,
          compare YES and NO capital share on Robinhood Chain.
        </p>
        <div className="hero-actions">
          <Link href="/markets" className="black-action">
            Explore markets <span aria-hidden="true">→</span>
          </Link>
          <Link href="/docs#start" className="text-action">
            How it works <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="atlas-status" aria-label="Product status">
          <p>
            <i />
            <span>
              <strong>Market discovery is live</strong>
              <small>Preview data</small>
            </span>
          </p>
          <p>
            <span className="atlas-status-index" aria-hidden="true">
              02
            </span>
            <span>
              <strong>Trading opens after onchain deployment</strong>
              <small>and final launch checks</small>
            </span>
          </p>
          <p>
            <span className="atlas-status-index" aria-hidden="true">
              03
            </span>
            <span>
              <strong>Capital share is not guaranteed</strong>
              <small>probability</small>
            </span>
          </p>
        </div>
      </div>

      <div
        ref={visualRef}
        className="market-atlas"
        role="img"
        aria-label={`Market atlas. YES ${yes}% capital share and NO ${no}% capital share. ${selectedNode.name} selected.`}
      >
        <canvas ref={canvasRef} className="market-atlas-canvas" aria-hidden="true" />
        <div className="atlas-share atlas-share-yes">
          <span>YES</span>
          <strong>{yes}%</strong>
          <small>Capital share</small>
        </div>
        <div className="atlas-share atlas-share-no">
          <span>NO</span>
          <strong>{no}%</strong>
          <small>Capital share</small>
        </div>
        {ATLAS_NODES.map((node) => (
          <button
            key={node.name}
            type="button"
            className={`atlas-node atlas-node-${node.tone}${selected === node.name ? " selected" : ""}`}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            aria-pressed={selected === node.name}
            aria-label={`Select ${node.name}, ${node.wallets} sample wallets`}
            onClick={() => setSelected(node.name)}
          >
            <span>{node.symbol}</span>
            <strong>{node.name}</strong>
          </button>
        ))}
        <span className="atlas-side-copy" aria-hidden="true">
          People
          <br />
          ideas
          <br />
          markets
          <br />
          tomorrow
        </span>
      </div>
    </section>
  );
}

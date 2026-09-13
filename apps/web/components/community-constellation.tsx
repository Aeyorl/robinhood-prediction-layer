"use client";

import { useEffect, useRef } from "react";

import type { CommunitySummary } from "@/lib/analytics-api";

type Point = { x: number; y: number };

const FALLBACK_POSITIONS: Point[] = [
  { x: 0.16, y: 0.46 },
  { x: 0.5, y: 0.17 },
  { x: 0.84, y: 0.44 },
  { x: 0.34, y: 0.8 },
  { x: 0.68, y: 0.8 },
];

const TOKEN_POSITIONS: Record<string, Point> = {
  PONS: { x: 0.16, y: 0.46 },
  CASHC: { x: 0.5, y: 0.17 },
  CASHCAT: { x: 0.5, y: 0.17 },
  STONK: { x: 0.84, y: 0.44 },
  USDG: { x: 0.34, y: 0.8 },
  AI: { x: 0.68, y: 0.8 },
};

const COLORS = ["#4b63ff", "#b7dc25", "#9bc219", "#4b63ff", "#6075ff"];

function labelFor(node: CommunitySummary) {
  return (node.symbol ?? node.name ?? "TOKEN").slice(0, 5).toUpperCase();
}

function pointFor(node: CommunitySummary, index: number) {
  return (
    TOKEN_POSITIONS[labelFor(node)] ??
    FALLBACK_POSITIONS[index % FALLBACK_POSITIONS.length] ??
    FALLBACK_POSITIONS[0]!
  );
}

type VisualState = {
  wallets: number;
  scale: number;
  revealAt: number;
};

export function CommunityConstellation({
  communities,
  selectedAddress,
  onSelect,
}: {
  communities: CommunitySummary[];
  selectedAddress: string;
  onSelect: (address: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef(communities);
  const selectedRef = useRef(selectedAddress);
  const visualRef = useRef(new Map<string, VisualState>());
  const startedAtRef = useRef(0);

  nodesRef.current = communities;
  selectedRef.current = selectedAddress;

  useEffect(() => {
    const now = performance.now();
    if (!startedAtRef.current) startedAtRef.current = now;
    const activeAddresses = new Set(communities.map((node) => node.tokenAddress));

    for (const [address] of visualRef.current) {
      if (!activeAddresses.has(address)) visualRef.current.delete(address);
    }
    communities.forEach((node, index) => {
      if (!visualRef.current.has(node.tokenAddress)) {
        visualRef.current.set(node.tokenAddress, {
          wallets: 0,
          scale: 0,
          revealAt: now + index * 115,
        });
      }
    });
  }, [communities]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hubImage = new window.Image();
    hubImage.src = "/icon.png";
    let frame = 0;
    let width = 0;
    let height = 0;
    let lastTime = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = (now: number, animate: boolean) => {
      const elapsed = Math.max(0, (now - startedAtRef.current) / 1000);
      const delta = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      const nodes = nodesRef.current;
      const selected = selectedRef.current;
      const maxWallets = Math.max(1, ...nodes.map((node) => node.participantCount));
      const sizeScale = Math.max(0.72, Math.min(1, width / 920, height / 560));
      const center = { x: width * 0.5, y: height * 0.52 };

      context.clearRect(0, 0, width, height);

      context.save();
      context.strokeStyle = "rgba(84, 81, 76, 0.09)";
      context.lineWidth = 1;
      for (let ring = 1; ring <= 4; ring += 1) {
        context.beginPath();
        context.arc(
          center.x,
          center.y,
          Math.min(width, height) * (0.12 + ring * 0.09),
          0,
          Math.PI * 2,
        );
        context.stroke();
      }
      context.fillStyle = "rgba(69, 66, 61, 0.12)";
      const dotGap = Math.max(15, Math.round(19 * sizeScale));
      for (let y = center.y - height * 0.25; y <= center.y + height * 0.25; y += dotGap) {
        for (let x = center.x - width * 0.22; x <= center.x + width * 0.22; x += dotGap) {
          const distance = Math.hypot(x - center.x, y - center.y);
          if (distance > Math.min(width, height) * 0.11) context.fillRect(x, y, 1, 1);
        }
      }
      context.restore();

      nodes.forEach((node, index) => {
        const point = pointFor(node, index);
        const x = point.x * width;
        const y = point.y * height;
        const state = visualRef.current.get(node.tokenAddress) ?? {
          wallets: node.participantCount,
          scale: 1,
          revealAt: now,
        };
        const targetScale = !animate || now >= state.revealAt ? 1 : 0;
        if (animate) {
          const ease = 1 - Math.exp(-delta * 7.5);
          state.wallets += (node.participantCount - state.wallets) * ease;
          state.scale += (targetScale - state.scale) * ease;
        } else {
          state.wallets = node.participantCount;
          state.scale = 1;
        }
        visualRef.current.set(node.tokenAddress, state);

        const selectedNode = node.tokenAddress === selected;
        const hasSelection = Boolean(selected);
        const alpha = hasSelection && !selectedNode ? 0.25 : 1;
        const color = COLORS[index % COLORS.length] ?? COLORS[0]!;
        const radius =
          (30 + Math.sqrt(Math.max(0, state.wallets) / maxWallets) * 22) * sizeScale * state.scale;

        context.save();
        context.globalAlpha = alpha;
        context.strokeStyle = selectedNode ? color : "rgba(75, 72, 67, 0.38)";
        context.lineWidth = selectedNode ? 2.4 : 1.15;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(center.x, center.y);
        context.stroke();

        const particleCount = 2 + Math.round((state.wallets / maxWallets) * 3);
        const speed = 0.055 + (state.wallets / maxWallets) * 0.105;
        for (let particle = 0; particle < particleCount; particle += 1) {
          const progress = animate
            ? (elapsed * speed + particle / particleCount + index * 0.13) % 1
            : (particle + 1) / (particleCount + 1);
          const px = x + (center.x - x) * progress;
          const py = y + (center.y - y) * progress;
          context.fillStyle = color;
          context.shadowColor = color;
          context.shadowBlur = selectedNode ? 12 : 5;
          context.beginPath();
          context.arc(px, py, selectedNode ? 3.1 : 2.1, 0, Math.PI * 2);
          context.fill();
        }

        if (selectedNode) {
          context.shadowColor = color;
          context.shadowBlur = 28;
          context.fillStyle = `${color}30`;
          context.beginPath();
          context.arc(x, y, radius + 10 * sizeScale, 0, Math.PI * 2);
          context.fill();
        }

        context.shadowColor = selectedNode ? color : "rgba(20, 20, 20, 0.18)";
        context.shadowBlur = selectedNode ? 22 : 12;
        context.fillStyle = selectedNode ? `${color}24` : "rgba(250, 249, 246, 0.96)";
        context.strokeStyle = selectedNode ? color : "rgba(94, 90, 84, 0.6)";
        context.lineWidth = selectedNode ? 2 : 1;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.shadowBlur = 0;

        context.fillStyle = "#101010";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = `${Math.max(16, radius * 0.48)}px Impact, 'Arial Narrow', sans-serif`;
        context.fillText(labelFor(node), x, y - radius * 0.12);
        context.fillStyle = "#66625d";
        context.font = `${Math.max(9, radius * 0.17)}px ui-sans-serif, system-ui, sans-serif`;
        context.fillText(`${Math.round(state.wallets)} wallets`, x, y + radius * 0.38);
        context.restore();
      });

      const hubRadius = 58 * sizeScale;
      context.save();
      context.fillStyle = "rgba(249, 248, 244, 0.98)";
      context.strokeStyle = "rgba(89, 85, 79, 0.42)";
      context.lineWidth = 1.2;
      context.shadowColor = "rgba(75, 99, 255, 0.18)";
      context.shadowBlur = 22;
      context.beginPath();
      context.arc(center.x, center.y, hubRadius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.shadowBlur = 0;
      if (hubImage.complete && hubImage.naturalWidth > 0) {
        const markSize = hubRadius * 0.78;
        context.drawImage(
          hubImage,
          center.x - markSize / 2,
          center.y - markSize / 2,
          markSize,
          markSize,
        );
      }
      context.restore();
    };

    const tick = (now: number) => {
      draw(now, true);
      frame = requestAnimationFrame(tick);
    };

    const syncMotion = () => {
      cancelAnimationFrame(frame);
      resize();
      if (motionQuery.matches) {
        draw(performance.now(), false);
      } else {
        frame = requestAnimationFrame(tick);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (motionQuery.matches) draw(performance.now(), false);
    });
    resizeObserver.observe(canvas);
    hubImage.addEventListener("load", syncMotion);
    motionQuery.addEventListener("change", syncMotion);
    syncMotion();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      hubImage.removeEventListener("load", syncMotion);
      motionQuery.removeEventListener("change", syncMotion);
    };
  }, [communities, selectedAddress]);

  return (
    <div className="community-constellation">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Community funding flows from token nodes toward the Poku activity hub"
      />
      {communities.map((node, index) => {
        const point = pointFor(node, index);
        const label = labelFor(node);
        return (
          <button
            key={node.tokenAddress}
            type="button"
            className="community-node-hit"
            style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
            onClick={() => onSelect(node.tokenAddress)}
            aria-label={`Select ${label}, ${node.participantCount} participating wallets`}
            aria-pressed={node.tokenAddress === selectedAddress}
          />
        );
      })}
    </div>
  );
}

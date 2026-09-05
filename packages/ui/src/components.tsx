import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn.js";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";

const buttonVariants: Record<Variant, string> = {
  primary:
    "bg-indigo-500 text-white shadow-[0_10px_30px_-12px_rgba(99,102,241,0.9)] hover:bg-indigo-400 disabled:bg-indigo-600/40 disabled:text-white/60",
  secondary:
    "border border-white/12 bg-white/[0.07] text-white hover:border-white/20 hover:bg-white/[0.11] disabled:opacity-50",
  ghost: "text-slate-300 hover:text-white hover:bg-white/5 disabled:opacity-50",
  danger: "bg-rose-600/90 text-white hover:bg-rose-600 disabled:opacity-50",
  success: "bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
}

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl font-semibold transition-[background-color,border-color,color,transform] duration-200 active:translate-y-px",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
        "disabled:cursor-not-allowed",
        size === "sm" && "px-2.5 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-5 py-2.5 text-base",
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.09] bg-slate-900/65 p-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.9)] backdrop-blur-xl",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold tracking-wide text-slate-300",
        className,
      )}
      {...props}
    />
  );
}

const badgeTone: Record<string, string> = {
  green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  red: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  slate: "border-white/10 bg-white/5 text-slate-300",
  indigo: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
};

export function StatusBadge({
  tone = "slate",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof badgeTone }) {
  return (
    <span
      className={cn(badgeTone[tone], "rounded-full px-2.5 py-0.5 text-xs font-semibold", className)}
      {...props}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-label="loading"
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white",
        className,
      )}
    />
  );
}

/** Section heading with eyebrow + title for page scaffolds. */
export function Section({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="space-y-1.5">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/** Skeleton block while data loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-white/10", className)} />;
}

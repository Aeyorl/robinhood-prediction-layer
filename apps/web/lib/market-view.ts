import { formatUnits } from "viem";

/**
 * Serializable market shape shared between the server (which reads the local
 * chain via viem) and client components (cards, trade panel, action panel).
 *
 * All BigInt values are carried as decimal strings so they survive the
 * RSC → client boundary without lossy conversion.
 */

export const MARKET_STATUS = ["OPEN", "LOCKED", "RESOLVED", "CANCELLED"] as const;
export const MARKET_SIDE = ["NONE", "YES", "NO"] as const;

export type MarketStatus = (typeof MARKET_STATUS)[number];
export type MarketSide = (typeof MARKET_SIDE)[number];
export type MarketComparator = "PRICE_ABOVE_AT_TIME" | "PRICE_BELOW_AT_TIME";

export const COLLATERAL_DECIMALS = 18;

export interface MarketView {
  /** Chain the market lives on (matches ACTIVE_CHAIN_ID). */
  chainId: number;
  address: string;
  slug: string;
  question: string;
  /** Oracle asset the market resolves against (symbol for display only). */
  assetSymbol: string;
  assetAddress: string;
  comparator: MarketComparator;
  comparatorLabel: string;
  /** Human-readable strike, e.g. "100.000". */
  strike: string;
  collateralSymbol: string;
  status: MarketStatus;
  /** Winning outcome when RESOLVED, else NONE. */
  side: MarketSide;
  /** Oracle price at resolution (collateral units), null until resolved. */
  resolvedPrice: string | null;
  resolvedAt: number | null;
  yesPool: string;
  noPool: string;
  totalPool: string;
  /** Pool split shown as shares of capital, 0–100 (null when empty). */
  yesSharePct: number | null;
  noSharePct: number | null;
  feeBps: string;
  minEntry: string;
  openTime: number;
  lockTime: number;
  resolutionTime: number;
  gracePeriodSeconds: number;
  feed: string;
  collateral: string;
}

export interface MarketViewInput {
  chainId: number;
  address: string;
  slug: string;
  question: string;
  assetSymbol: string;
  assetAddress: string;
  comparator: MarketComparator;
  strike: string;
  strikeDecimals: number;
  collateralSymbol: string;
  collateral: string;
  feeBps: string;
  minEntry: string;
  openTime: number;
  lockTime: number;
  resolutionTime: number;
  gracePeriodSeconds: number;
  feed: string;
  status: number;
  side: number;
  resolvedPrice: string;
  resolvedAt: number;
  yesPool: string;
  noPool: string;
}

const COMPARATOR_LABEL: Record<MarketComparator, string> = {
  PRICE_ABOVE_AT_TIME: "Price above at time",
  PRICE_BELOW_AT_TIME: "Price below at time",
};

export function humanAmount(
  raw: string | bigint,
  decimals = COLLATERAL_DECIMALS,
  maxFrac = 4,
): string {
  const value = BigInt(raw);
  if (value === 0n) return "0";
  const formatted = formatUnits(value, decimals);
  const dot = formatted.indexOf(".");
  const whole = dot === -1 ? formatted : formatted.slice(0, dot);
  const frac = dot === -1 ? "" : formatted.slice(dot + 1);
  if (frac === "") return whole;
  const trimmed = frac.replace(/0+$/, "").slice(0, maxFrac);
  return trimmed === "" ? whole : `${whole}.${trimmed}`;
}

/** Thousands-separated whole part of a human amount ("1,234.56"). */
export function groupedAmount(
  raw: string | bigint,
  decimals = COLLATERAL_DECIMALS,
  maxFrac = 4,
): string {
  const human = humanAmount(raw, decimals, maxFrac);
  const dot = human.indexOf(".");
  const whole = dot === -1 ? human : human.slice(0, dot);
  const frac = dot === -1 ? "" : human.slice(dot + 1);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac === "" ? grouped : `${grouped}.${frac}`;
}

function toStatus(n: number): MarketStatus {
  return n === 1 ? "LOCKED" : n === 2 ? "RESOLVED" : n === 3 ? "CANCELLED" : "OPEN";
}

function toSide(n: number): MarketSide {
  return n === 1 ? "YES" : n === 2 ? "NO" : "NONE";
}

/** Share of total capital on each side (0–100, one decimal). */
export function splitPcts(
  yesPool: string | bigint,
  noPool: string | bigint,
): {
  yesSharePct: number | null;
  noSharePct: number | null;
} {
  const yes = BigInt(yesPool);
  const no = BigInt(noPool);
  const total = yes + no;
  if (total === 0n) return { yesSharePct: null, noSharePct: null };
  const pct = (part: bigint) => Number((part * 10_000n) / total) / 100;
  return { yesSharePct: pct(yes), noSharePct: pct(no) };
}

export function makeMarketView(input: MarketViewInput): MarketView {
  const { yesSharePct, noSharePct } = splitPcts(input.yesPool, input.noPool);
  return {
    chainId: input.chainId,
    address: input.address,
    slug: input.slug,
    question: input.question,
    assetSymbol: input.assetSymbol,
    assetAddress: input.assetAddress,
    comparator: input.comparator,
    comparatorLabel: COMPARATOR_LABEL[input.comparator],
    strike: humanAmount(input.strike, input.strikeDecimals, 6),
    collateralSymbol: input.collateralSymbol,
    status: toStatus(input.status),
    side: toSide(input.side),
    resolvedPrice:
      input.status === 2 ? humanAmount(input.resolvedPrice, input.strikeDecimals, 6) : null,
    resolvedAt: input.status === 2 && input.resolvedAt > 0 ? input.resolvedAt : null,
    yesPool: input.yesPool,
    noPool: input.noPool,
    totalPool: (BigInt(input.yesPool) + BigInt(input.noPool)).toString(),
    yesSharePct,
    noSharePct,
    feeBps: input.feeBps,
    minEntry: input.minEntry,
    openTime: input.openTime,
    lockTime: input.lockTime,
    resolutionTime: input.resolutionTime,
    gracePeriodSeconds: input.gracePeriodSeconds,
    feed: input.feed,
    collateral: input.collateral,
  };
}

import "server-only";

import { z } from "zod";

import { stockSampleMarkets, type SampleMarket } from "@/lib/sample-markets";

const ROBINHOOD_CHAIN_ID = "robinhood";
const MIN_MARKET_CAP_USD = 30_000_000;
const MIN_LIQUIDITY_USD = 100_000;
const CACHE_MS = 60_000;

const candidates = [
  {
    symbol: "PONS",
    address: "0x39dBED3a2bd333467115dE45665cC57F813C4571",
    strike: "$0.90",
    yesShare: 58,
  },
  {
    symbol: "CASHCAT",
    address: "0x020bfC650A365f8BB26819deAAbF3E21291018b4",
    strike: "$0.25",
    yesShare: 47,
  },
  {
    symbol: "AI",
    address: "0x2E8c31162b855A2ffa90F6F8634643Ad6F111e18",
    strike: "$0.30",
    yesShare: 44,
  },
] as const;

const pairSchema = z.object({
  chainId: z.string(),
  dexId: z.string(),
  url: z.string().url(),
  pairAddress: z.string(),
  baseToken: z.object({ address: z.string(), symbol: z.string(), name: z.string() }),
  marketCap: z.number().nullable().optional(),
  fdv: z.number().nullable().optional(),
  liquidity: z.object({ usd: z.number().nullable().optional() }).optional(),
  volume: z.object({ h24: z.number().nullable().optional() }).optional(),
});

type Pair = z.infer<typeof pairSchema>;
export type MemeDiscoveryState = { status: "live" } | { status: "unavailable"; message: string };
export type PublicMarkets = { markets: readonly SampleMarket[]; memeDiscovery: MemeDiscoveryState };

let cache: { expiresAt: number; result: PublicMarkets } | null = null;
let inFlight: Promise<PublicMarkets> | null = null;

function compactUsd(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

function numberOrZero(value: number | null | undefined) {
  return value ?? 0;
}

function qualifies(pair: Pair, candidate: (typeof candidates)[number]) {
  const marketCap = numberOrZero(pair.marketCap);
  return (
    pair.chainId === ROBINHOOD_CHAIN_ID &&
    pair.baseToken.address.toLowerCase() === candidate.address.toLowerCase() &&
    marketCap >= MIN_MARKET_CAP_USD &&
    numberOrZero(pair.liquidity?.usd) >= MIN_LIQUIDITY_USD
  );
}

function toMarket(candidate: (typeof candidates)[number], pair: Pair): SampleMarket {
  const marketCap = numberOrZero(pair.marketCap);
  return {
    slug: `${candidate.symbol.toLowerCase()}-above-${candidate.strike.replace(/[^0-9]/g, "")}-oct-31`,
    category: "MEMECOINS",
    symbol: candidate.symbol,
    assetName: pair.baseToken.name,
    question: `Will ${candidate.symbol} trade above ${candidate.strike} on Oct 31?`,
    closeLabel: "Closes Oct 31, 11:59 PM UTC",
    closeTime: "Oct 31",
    status: "OPEN",
    volume: `${compactUsd(numberOrZero(pair.volume?.h24))} USD / 24h`,
    yesShare: candidate.yesShare,
    noShare: 100 - candidate.yesShare,
    oracle: "DexScreener discovery data · Robinhood Chain",
    resolutionMethod: "Future market: defined reference price and timestamped evidence",
    evidenceStatus: "Preview — pair currently passes the configured discovery screen",
    terms: `YES resolves only if the future defined reference price is strictly above ${candidate.strike} at the deadline.`,
    sourceLabel: `DexScreener · ${pair.dexId}`,
    sourceUrl: pair.url,
    marketCapLabel: `Market cap estimate ${compactUsd(marketCap)}`,
    liquidityLabel: `${compactUsd(numberOrZero(pair.liquidity?.usd))} liquidity`,
  };
}

async function fetchPairs(candidate: (typeof candidates)[number]) {
  const response = await fetch(
    `https://api.dexscreener.com/token-pairs/v1/${ROBINHOOD_CHAIN_ID}/${candidate.address}`,
    { next: { revalidate: 60 }, signal: AbortSignal.timeout(5_000) },
  );
  if (!response.ok) throw new Error(`DexScreener returned ${response.status}`);
  const parsed = z.array(pairSchema).safeParse(await response.json());
  if (!parsed.success) throw new Error("DexScreener returned an invalid pair payload");
  return parsed.data
    .filter((pair) => qualifies(pair, candidate))
    .sort((a, b) => numberOrZero(b.liquidity?.usd) - numberOrZero(a.liquidity?.usd))[0];
}

async function refresh(): Promise<PublicMarkets> {
  try {
    const results = await Promise.allSettled(
      candidates.map(async (candidate) => ({ candidate, pair: await fetchPairs(candidate) })),
    );
    const fulfilledResults = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    const memes = fulfilledResults.flatMap(({ candidate, pair }) =>
      pair ? [toMarket(candidate, pair)] : [],
    );
    if (memes.length === 0) {
      return {
        markets: stockSampleMarkets,
        memeDiscovery: {
          status: "unavailable",
          message: fulfilledResults.length
            ? "No Robinhood-chain meme pairs currently meet the $30m market-cap and $100k liquidity discovery screen."
            : "Robinhood meme discovery is temporarily unavailable. No cached or invented meme data is shown.",
        },
      };
    }
    return { markets: [...stockSampleMarkets, ...memes], memeDiscovery: { status: "live" } };
  } catch {
    return {
      markets: stockSampleMarkets,
      memeDiscovery: {
        status: "unavailable",
        message:
          "Robinhood meme discovery is temporarily unavailable. No cached or invented meme data is shown.",
      },
    };
  }
}

export async function loadPublicMarkets(): Promise<PublicMarkets> {
  if (cache && cache.expiresAt > Date.now()) return cache.result;
  if (!inFlight)
    inFlight = refresh().finally(() => {
      inFlight = null;
    });
  const result = await inFlight;
  cache = { result, expiresAt: Date.now() + CACHE_MS };
  return result;
}

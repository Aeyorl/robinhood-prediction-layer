import { z } from "zod";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const marketSplitSchema = z.object({
  chainId: z.number(),
  address: z.string(),
  slug: z.string(),
  question: z.string(),
  status: z.enum(["OPEN", "LOCKED", "RESOLVED", "CANCELLED"]),
  winningOutcome: z.enum(["YES", "NO"]).nullable(),
  yesVolumeUsdg: z.string(),
  noVolumeUsdg: z.string(),
  volumeUsdg: z.string(),
  participantCount: z.number(),
  yesShareBps: z.number().nullable(),
  strongestSide: z.enum(["YES", "NO"]).nullable(),
});

export const rankedWalletSchema = z.object({
  address: z.string(),
  volumeUsdg: z.string(),
  realizedPnlUsdg: z.string(),
  roiBps: z.number().nullable(),
  hitRateBps: z.number().nullable(),
  resolvedMarkets: z.number(),
  wins: z.number(),
  losses: z.number(),
  neutral: z.number(),
  currentStreak: z.number(),
  largestWinUsdg: z.string(),
});

const communitySummarySchema = z.object({
  chainId: z.number(),
  tokenAddress: z.string(),
  symbol: z.string().nullable(),
  name: z.string().nullable(),
  decimals: z.number().nullable(),
  logoUrl: z.string().nullable(),
  volumeUsdg: z.string(),
  participantCount: z.number(),
  marketCount: z.number(),
  resolvedMarkets: z.number(),
  wins: z.number(),
  losses: z.number(),
  neutral: z.number(),
  realizedPnlUsdg: z.string(),
  roiBps: z.number().nullable(),
  hitRateBps: z.number().nullable(),
  topCurrentStance: marketSplitSchema.extend({ shareBps: z.number() }).nullable(),
});

export type CommunitySummary = z.infer<typeof communitySummarySchema>;
export type MarketSplit = z.infer<typeof marketSplitSchema>;
export type RankedWallet = z.infer<typeof rankedWalletSchema>;

async function analyticsRequest(path: string) {
  const response = await fetch(`${apiUrl}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? `Analytics request failed (${response.status})`);
  return data as unknown;
}

export async function getCommunities(window = "7d") {
  return z
    .object({
      window: z.string(),
      attribution: z.array(z.string()),
      communities: z.array(communitySummarySchema),
      nextOffset: z.number().nullable(),
    })
    .parse(await analyticsRequest(`/v1/communities?window=${window}`));
}

export async function getCommunity(chainId: string, tokenAddress: string, window = "all") {
  return z
    .object({
      window: z.string(),
      attribution: z.array(z.string()),
      community: communitySummarySchema.extend({
        markets: z.array(marketSplitSchema),
        topPredictors: z.array(rankedWalletSchema),
      }),
    })
    .parse(await analyticsRequest(`/v1/communities/${chainId}/${tokenAddress}?window=${window}`));
}

export async function getLeaderboard(
  metric: "pnl" | "roi" | "hit_rate" | "volume" = "pnl",
  window = "all",
) {
  return z
    .object({
      window: z.string(),
      metric: z.string(),
      attribution: z.array(z.string()),
      minimumResolvedMarkets: z.number(),
      entries: z.array(rankedWalletSchema),
    })
    .parse(await analyticsRequest(`/v1/leaderboard?metric=${metric}&window=${window}`));
}

export async function getProfile(address: string, window = "all") {
  return z
    .object({
      window: z.string(),
      attribution: z.array(z.string()),
      profile: z.object({
        address: z.string(),
        stats: rankedWalletSchema,
        communities: z.array(
          z.object({
            chainId: z.number(),
            tokenAddress: z.string(),
            symbol: z.string().nullable(),
            name: z.string().nullable(),
            volumeUsdg: z.string(),
            realizedPnlUsdg: z.string(),
            marketCount: z.number(),
          }),
        ),
        recentPredictions: z.array(
          z.object({
            marketChainId: z.number(),
            marketAddress: z.string(),
            marketSlug: z.string(),
            question: z.string(),
            winningOutcome: z.enum(["YES", "NO"]),
            result: z.enum(["WIN", "LOSS", "NEUTRAL"]),
            yesVolumeUsdg: z.string(),
            noVolumeUsdg: z.string(),
            realizedPnlUsdg: z.string(),
            resolvedAt: z.string(),
            fundingToken: z.object({
              chainId: z.number(),
              address: z.string(),
              symbol: z.string().nullable(),
            }),
          }),
        ),
      }),
    })
    .parse(await analyticsRequest(`/v1/profiles/${address}?window=${window}`));
}

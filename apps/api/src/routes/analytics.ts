import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { addressSchema } from "@pl/types";

import {
  analyticsWindows,
  buildCommunityAnalytics,
  buildWalletLeaderboard,
  buildWalletProfile,
  loadAnalyticsRows,
  minimumRankedMarkets,
  sortLeaderboard,
} from "../analytics.js";
import type { ServerDeps } from "../server.js";

const windowSchema = z.enum(analyticsWindows);
const windowQuerySchema = z.object({ window: windowSchema.default("all") });
const listQuerySchema = windowQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
const communityParamSchema = z.object({
  chainId: z.coerce.number().int().positive(),
  tokenAddress: addressSchema,
});
const leaderboardQuerySchema = windowQuerySchema.extend({
  metric: z.enum(["pnl", "roi", "hit_rate", "volume"]).default("pnl"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
const marketParamSchema = z.object({ address: addressSchema });

export const analyticsRoutes: FastifyPluginAsync<ServerDeps> = async (app, deps) => {
  app.get("/v1/markets/:address/community-splits", async (request, reply) => {
    if (!deps.db) return reply.code(503).send({ error: "database_unavailable" });
    const params = marketParamSchema.safeParse(request.params);
    const query = windowQuerySchema.safeParse(request.query);
    if (!params.success || !query.success)
      return reply.code(400).send({ error: "invalid_request" });
    const address = params.data.address.toLowerCase();
    const communities = buildCommunityAnalytics(
      await loadAnalyticsRows(deps.db, query.data.window),
    );
    const splits = communities.flatMap((community) => {
      const market = community.markets.find(
        (item) => item.chainId === deps.env.CHAIN_ID && item.address === address,
      );
      return market
        ? [
            {
              fundingToken: {
                chainId: community.chainId,
                address: community.tokenAddress,
                symbol: community.symbol,
                name: community.name,
              },
              ...market,
            },
          ]
        : [];
    });
    if (!splits.length) return reply.code(404).send({ error: "market_splits_not_found" });
    return { window: query.data.window, attribution: ["ONCHAIN", "SESSION_CORRELATED"], splits };
  });

  app.get("/v1/communities", async (request, reply) => {
    if (!deps.db) return reply.code(503).send({ error: "database_unavailable" });
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success)
      return reply.code(400).send({ error: "invalid_query", issues: parsed.error.issues });
    const { window, limit, offset } = parsed.data;
    const communities = buildCommunityAnalytics(await loadAnalyticsRows(deps.db, window));
    return {
      window,
      attribution: ["ONCHAIN", "SESSION_CORRELATED"],
      communities: communities.slice(offset, offset + limit).map(withoutDetails),
      nextOffset: offset + limit < communities.length ? offset + limit : null,
    };
  });

  app.get("/v1/communities/:chainId/:tokenAddress", async (request, reply) => {
    if (!deps.db) return reply.code(503).send({ error: "database_unavailable" });
    const params = communityParamSchema.safeParse(request.params);
    const query = windowQuerySchema.safeParse(request.query);
    if (!params.success || !query.success)
      return reply.code(400).send({ error: "invalid_request" });
    const community = buildCommunityAnalytics(
      await loadAnalyticsRows(deps.db, query.data.window),
    ).find(
      (item) =>
        item.chainId === params.data.chainId &&
        item.tokenAddress === params.data.tokenAddress.toLowerCase(),
    );
    if (!community) return reply.code(404).send({ error: "community_not_found" });
    return {
      window: query.data.window,
      attribution: ["ONCHAIN", "SESSION_CORRELATED"],
      community,
    };
  });

  app.get("/v1/communities/:chainId/:tokenAddress/markets", async (request, reply) => {
    if (!deps.db) return reply.code(503).send({ error: "database_unavailable" });
    const params = communityParamSchema.safeParse(request.params);
    const query = listQuerySchema.safeParse(request.query);
    if (!params.success || !query.success)
      return reply.code(400).send({ error: "invalid_request" });
    const community = buildCommunityAnalytics(
      await loadAnalyticsRows(deps.db, query.data.window),
    ).find(
      (item) =>
        item.chainId === params.data.chainId &&
        item.tokenAddress === params.data.tokenAddress.toLowerCase(),
    );
    if (!community) return reply.code(404).send({ error: "community_not_found" });
    return {
      window: query.data.window,
      markets: community.markets.slice(query.data.offset, query.data.offset + query.data.limit),
      nextOffset:
        query.data.offset + query.data.limit < community.markets.length
          ? query.data.offset + query.data.limit
          : null,
    };
  });

  app.get("/v1/leaderboard", async (request, reply) => {
    if (!deps.db) return reply.code(503).send({ error: "database_unavailable" });
    const parsed = leaderboardQuerySchema.safeParse(request.query);
    if (!parsed.success)
      return reply.code(400).send({ error: "invalid_query", issues: parsed.error.issues });
    const { window, metric, limit } = parsed.data;
    const entries = sortLeaderboard(
      buildWalletLeaderboard(await loadAnalyticsRows(deps.db, window)),
      metric,
    ).slice(0, limit);
    return {
      window,
      metric,
      attribution: ["ONCHAIN", "SESSION_CORRELATED"],
      minimumResolvedMarkets: metric === "roi" || metric === "hit_rate" ? minimumRankedMarkets : 0,
      entries,
    };
  });

  app.get("/v1/profiles/:address", async (request, reply) => {
    if (!deps.db) return reply.code(503).send({ error: "database_unavailable" });
    const params = z.object({ address: addressSchema }).safeParse(request.params);
    const query = windowQuerySchema.safeParse(request.query);
    if (!params.success || !query.success)
      return reply.code(400).send({ error: "invalid_request" });
    const profile = buildWalletProfile(
      await loadAnalyticsRows(deps.db, query.data.window),
      params.data.address,
    );
    if (!profile.stats) return reply.code(404).send({ error: "profile_not_found" });
    return {
      window: query.data.window,
      attribution: ["ONCHAIN", "SESSION_CORRELATED"],
      profile,
    };
  });
};

function withoutDetails(community: ReturnType<typeof buildCommunityAnalytics>[number]) {
  const { markets: _markets, topPredictors: _topPredictors, ...summary } = community;
  return summary;
}

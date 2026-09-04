import type { FastifyPluginAsync } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { markets, marketStatusEnum } from "@pl/database";

import type { ServerDeps } from "../server.js";

const listQuerySchema = z.object({
  status: z.enum(marketStatusEnum.enumValues).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const addressParamSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "invalid market address"),
});

export const marketRoutes: FastifyPluginAsync<ServerDeps> = async (app, deps) => {
  app.get("/v1/markets", async (request, reply) => {
    if (!deps.db) {
      return reply.code(503).send({ error: "database_unavailable" });
    }
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_query", issues: parsed.error.issues });
    }
    const { status, limit, offset } = parsed.data;

    const rows = await deps.db
      .select()
      .from(markets)
      .where(status ? and(eq(markets.status, status)) : undefined)
      .orderBy(desc(markets.createdAt))
      .limit(limit)
      .offset(offset);
    return { markets: rows.map(serializeMarket) };
  });

  app.get("/v1/markets/:address", async (request, reply) => {
    if (!deps.db) {
      return reply.code(503).send({ error: "database_unavailable" });
    }
    const parsed = addressParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_param", issues: parsed.error.issues });
    }
    const row = await deps.db.query.markets.findFirst({
      where: (markets, { and, eq }) =>
        and(
          eq(markets.chainId, deps.env.CHAIN_ID),
          eq(markets.address, parsed.data.address.toLowerCase()),
        ),
    });
    if (!row) return reply.code(404).send({ error: "market_not_found" });
    return { market: serializeMarket(row) };
  });
};

function serializeMarket(row: typeof markets.$inferSelect) {
  return {
    chainId: row.chainId,
    address: row.address,
    slug: row.slug,
    question: row.question,
    template: row.template,
    comparator: row.comparator,
    strike: row.strike,
    strikeDecimals: row.strikeDecimals,
    collateral: { chainId: row.collateralChainId, address: row.collateralAddress },
    oracleAsset: { chainId: row.oracleAssetChainId, address: row.oracleAssetAddress },
    resolver: row.resolver,
    feeBps: row.feeBps,
    openTime: row.openTime.toISOString(),
    lockTime: row.lockTime.toISOString(),
    resolutionTime: row.resolutionTime.toISOString(),
    gracePeriodSeconds: row.gracePeriodSeconds,
    minEntry: row.minEntry,
    maxEntry: row.maxEntry,
    status: row.status,
    winningOutcome: row.winningOutcome,
    resolvedPrice: row.resolvedPrice,
    yesPool: row.yesPool,
    noPool: row.noPool,
    volumeUsdg: row.volumeUsdg,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
  };
}

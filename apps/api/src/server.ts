import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { fundingRoutes } from "./routes/funding.js";
import type { FundingService } from "./funding.js";
import type { ApiEnv } from "@pl/config";
import type { Database } from "@pl/database";
import Fastify, { type FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type postgres from "postgres";

import { healthRoutes } from "./routes/health.js";
import { marketRoutes } from "./routes/markets.js";

export interface ServerDeps {
  env: ApiEnv;
  db: Database | null;
  /** Raw postgres.js client used for reachability pings. */
  sql: postgres.Sql | null;
  redis: Redis | null;
  funding?: FundingService;
}

export async function buildServer(deps: ServerDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: true, bodyLimit: 16_384 });
  await app.register(rateLimit, { global: false, ...(deps.redis ? { redis: deps.redis } : {}) });

  await app.register(cors, {
    origin: deps.env.CORS_ORIGIN.split(",").map((o) => o.trim()),
  });

  await app.register(healthRoutes, deps);
  await app.register(marketRoutes, deps);
  await app.register(fundingRoutes, deps);

  return app;
}

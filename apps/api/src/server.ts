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
import { analyticsRoutes } from "./routes/analytics.js";

export interface ServerDeps {
  env: ApiEnv;
  db: Database | null;
  /** Raw postgres.js client used for reachability pings. */
  sql: postgres.Sql | null;
  redis: Redis | null;
  funding?: FundingService;
}

export async function buildServer(deps: ServerDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
    bodyLimit: 16_384,
    trustProxy: deps.env.PRODUCTION_MODE,
  });
  await app.register(rateLimit, {
    global: true,
    max: deps.env.API_RATE_LIMIT_MAX,
    timeWindow: "1 minute",
    ...(deps.redis ? { redis: deps.redis } : {}),
  });

  const startedAt = Date.now();
  let requests = 0;
  let serverErrors = 0;
  app.addHook("onResponse", (_request, reply, done) => {
    requests++;
    if (reply.statusCode >= 500) serverErrors++;
    done();
  });
  app.addHook("onSend", (_request, reply, payload, done) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("referrer-policy", "no-referrer");
    reply.header("permissions-policy", "camera=(), microphone=(), geolocation=()");
    if (deps.env.PRODUCTION_MODE)
      reply.header("strict-transport-security", "max-age=31536000; includeSubDomains");
    done(null, payload);
  });

  await app.register(cors, {
    origin: deps.env.CORS_ORIGIN.split(",").map((o) => o.trim()),
  });

  app.get("/metrics", { config: { rateLimit: false } }, async () => ({
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    requests,
    serverErrors,
    timestamp: new Date().toISOString(),
  }));

  await app.register(healthRoutes, deps);
  await app.register(marketRoutes, deps);
  await app.register(fundingRoutes, deps);
  await app.register(analyticsRoutes, deps);

  return app;
}

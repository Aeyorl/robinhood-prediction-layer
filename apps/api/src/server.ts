import cors from "@fastify/cors";
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
}

export async function buildServer(deps: ServerDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: true, trustProxy: true });

  await app.register(cors, {
    origin: deps.env.CORS_ORIGIN.split(",").map((o) => o.trim()),
  });

  await app.register(healthRoutes, deps);
  await app.register(marketRoutes, deps);

  return app;
}

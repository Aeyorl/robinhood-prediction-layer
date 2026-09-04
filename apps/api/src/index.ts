import { loadApiEnv } from "@pl/config";
import { createClient } from "@pl/database";
import Redis from "ioredis";

import { buildServer } from "./server.js";

async function main() {
  const env = loadApiEnv();

  // Database + Redis are optional at boot: the API starts anyway and reports
  // their state via /health — it never fabricates an "up" state.
  let db: ReturnType<typeof createClient>["db"] | null = null;
  let sql: ReturnType<typeof createClient>["client"] | null = null;
  try {
    const client = createClient(env.DATABASE_URL);
    sql = client.client;
    await sql`select 1`;
    db = client.db;
    console.log("[api] connected to postgres");
  } catch (err) {
    console.warn(
      "[api] postgres unavailable — starting without db:",
      err instanceof Error ? err.message : err,
    );
  }

  let redis: Redis | null = null;
  try {
    redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    await redis.connect();
    console.log("[api] connected to redis");
  } catch (err) {
    console.warn(
      "[api] redis unavailable — starting without redis:",
      err instanceof Error ? err.message : err,
    );
  }

  const app = await buildServer({ env, db, sql, redis });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "shutting down");
    await app.close();
    await redis?.quit().catch(() => undefined);
    await sql?.end().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

void main().catch((err) => {
  console.error("[api] fatal:", err);
  process.exit(1);
});

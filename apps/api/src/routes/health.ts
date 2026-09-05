import type { FastifyPluginAsync } from "fastify";

import type { ServerDeps } from "../server.js";

const PING_TIMEOUT_MS = 2_000;

async function pingRedis(redis: ServerDeps["redis"]): Promise<boolean> {
  if (!redis) return false;
  try {
    const result = await Promise.race([
      redis.ping(),
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), PING_TIMEOUT_MS)),
    ]);
    return result === "PONG";
  } catch {
    return false;
  }
}

async function pingDb(sql: ServerDeps["sql"]): Promise<boolean> {
  if (!sql) return false;
  try {
    const result = await Promise.race([
      sql`select 1`,
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), PING_TIMEOUT_MS)),
    ]);
    return result !== "timeout";
  } catch {
    return false;
  }
}

export const healthRoutes: FastifyPluginAsync<ServerDeps> = async (app, deps) => {
  app.get("/health", { config: { rateLimit: false } }, async () => {
    const [db, redis] = await Promise.all([pingDb(deps.sql), pingRedis(deps.redis)]);
    return {
      ok: db && redis,
      db: db ? "up" : "down",
      redis: redis ? "up" : "down",
      timestamp: new Date().toISOString(),
    };
  });
};

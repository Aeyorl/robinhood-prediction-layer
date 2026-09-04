import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

export * from "./schema.js";

export type Database = PostgresJsDatabase<typeof schema>;

export const defaultDatabaseUrl =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/prediction";

export function createClient(connectionString: string = defaultDatabaseUrl) {
  const client = postgres(connectionString, { max: 10, idle_timeout: 20 });
  const db = drizzle(client, { schema }) as Database;
  return { client, db };
}

/** Ping the database; returns true when reachable. */
export async function isDatabaseReachable(
  connectionString: string = defaultDatabaseUrl,
): Promise<boolean> {
  try {
    const { client } = createClient(connectionString);
    await client`select 1`;
    await client.end();
    return true;
  } catch {
    return false;
  }
}

import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@pl/database";

/** Each run owns only its randomly named schema; existing application data is untouched. */
export async function testDatabase() {
  const namespace = `pl_test_${randomUUID().replaceAll("-", "")}`;
  const url =
    process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/prediction";
  const admin = postgres(url, { max: 1, connect_timeout: 5, onnotice: () => {} });
  await admin.unsafe(`CREATE SCHEMA "${namespace}"`);
  const client = postgres(url, {
    max: 5,
    connect_timeout: 5,
    connection: { search_path: namespace },
    onnotice: () => {},
  });
  const migrationDir = fileURLToPath(
    new URL("../../../packages/database/drizzle/", import.meta.url),
  );
  for (const file of readdirSync(migrationDir)
    .filter((p) => p.endsWith(".sql"))
    .sort()) {
    const content = readFileSync(`${migrationDir}/${file}`, "utf8").replaceAll(
      '"public".',
      `"${namespace}".`,
    );
    for (const statement of content.split("--> statement-breakpoint"))
      if (statement.trim()) await client.unsafe(statement);
  }
  return {
    db: drizzle(client, { schema }) as schema.Database,
    client,
    namespace,
    async close() {
      await client.end();
      await admin.unsafe(`DROP SCHEMA "${namespace}" CASCADE`);
      await admin.end();
    },
  };
}

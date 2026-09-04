/**
 * Seeds local demo data (markets, assets, oracle config) from the local
 * Foundry deployment file written by `DeployLocal.s.sol`.
 *
 * Everything seeded here is clearly local/test data — it must never masquerade
 * as live mainnet data. Requires:
 *   1. a local chain (anvil) with the contract vertical slice deployed
 *      (`pnpm contracts:local`),
 *   2. PostgreSQL running (`pnpm dev:infra`).
 *
 * If either is missing this script prints instructions and exits 0 so that
 * `pnpm seed` is safe to run at any point during local development.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assets, markets, oracleAssets, createClient } from "./index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const deploymentFile = resolve(__dirname, "../../contracts/deployments/local.json");

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/prediction";

interface LocalDeployment {
  chainId: number;
  factory: string;
  oracleRegistry: string;
  chainlinkPriceResolver: string;
  feeVault: string;
  usdg: string;
  mocks: Record<string, { address: string; symbol: string; name: string; decimals: number }>;
  markets: Array<{
    address: string;
    slug: string;
    question: string;
    template: string;
    comparator: string;
    strike: string;
    strikeDecimals: number;
    asset: string;
    feed: string;
    sequencerFeed: string | null;
    heartbeatSeconds: number;
    feeBps: number;
    openTime: number;
    lockTime: number;
    resolutionTime: number;
    gracePeriodSeconds: number;
    minEntry: string;
    maxEntry: string | null;
  }>;
}

async function main(): Promise<void> {
  if (!existsSync(deploymentFile)) {
    console.log(
      `[seed] No local deployment file at ${deploymentFile}.\n` +
        `Run "pnpm contracts:local" first (starts anvil + deploys the vertical slice), then re-run "pnpm seed".`,
    );
    return;
  }

  const deployment = JSON.parse(readFileSync(deploymentFile, "utf8")) as LocalDeployment;

  let sql;
  try {
    ({ client: sql } = createClient(connectionString));
    await sql`select 1`;
  } catch (err) {
    console.log(
      `[seed] PostgreSQL unreachable at ${connectionString}.\n` +
        `Run "pnpm dev:infra" to start Postgres, apply migrations ("pnpm db:migrate"), then re-run "pnpm seed".\n` +
        `(${err instanceof Error ? err.message : String(err)})`,
    );
    if (sql) await sql.end().catch(() => undefined);
    return;
  }

  const { db } = createClient(connectionString);
  const chainId = deployment.chainId;

  // Assets (mocks are clearly local/test data)
  for (const [key, mock] of Object.entries(deployment.mocks)) {
    await db
      .insert(assets)
      .values({
        chainId,
        address: mock.address.toLowerCase(),
        symbol: mock.symbol,
        name: mock.name,
        decimals: mock.decimals,
        supportStatus: "DISCOVERED",
      })
      .onConflictDoUpdate({
        target: [assets.chainId, assets.address],
        set: {
          symbol: mock.symbol,
          name: mock.name,
          decimals: mock.decimals,
          updatedAt: new Date(),
        },
      });
    console.log(`[seed] asset ${key} (${mock.symbol}) at ${mock.address}`);
  }

  // Oracle config
  for (const m of deployment.markets) {
    if (!m.sequencerFeed) continue;
    await db
      .insert(oracleAssets)
      .values({
        chainId,
        address: m.asset.toLowerCase(),
        feedAddress: m.feed.toLowerCase(),
        sequencerFeedAddress: m.sequencerFeed.toLowerCase(),
        heartbeatSeconds: m.heartbeatSeconds,
        feedDecimals: 18, // mock feeds
        paused: false,
      })
      .onConflictDoUpdate({
        target: [oracleAssets.chainId, oracleAssets.address],
        set: { feedAddress: m.feed.toLowerCase(), updatedAt: new Date() },
      });
  }

  // Markets
  for (const m of deployment.markets) {
    const existing = await db.query.markets.findFirst({
      where: (markets, { and, eq }) =>
        and(eq(markets.chainId, chainId), eq(markets.address, m.address.toLowerCase())),
    });
    if (existing) {
      console.log(`[seed] market ${m.slug} already present, skipping`);
      continue;
    }
    await db.insert(markets).values({
      chainId,
      address: m.address.toLowerCase(),
      slug: m.slug,
      question: m.question,
      template: m.template as "PRICE_ABOVE_AT_TIME" | "PRICE_BELOW_AT_TIME",
      comparator: m.comparator as "PRICE_ABOVE_AT_TIME" | "PRICE_BELOW_AT_TIME",
      strike: m.strike,
      strikeDecimals: m.strikeDecimals,
      collateralChainId: chainId,
      collateralAddress: deployment.usdg.toLowerCase(),
      oracleAssetChainId: chainId,
      oracleAssetAddress: m.asset.toLowerCase(),
      resolver: deployment.chainlinkPriceResolver.toLowerCase(),
      feeBps: m.feeBps,
      openTime: new Date(m.openTime * 1000),
      lockTime: new Date(m.lockTime * 1000),
      resolutionTime: new Date(m.resolutionTime * 1000),
      gracePeriodSeconds: m.gracePeriodSeconds,
      minEntry: m.minEntry,
      maxEntry: m.maxEntry,
      status: "OPEN",
      yesPool: "0",
      noPool: "0",
      metadataUri: "",
    });
    console.log(`[seed] market ${m.slug} at ${m.address}`);
  }

  await sql.end();
  console.log("[seed] done — this data is LOCAL/TEST data only.");
}

void main().catch((err) => {
  console.error("[seed] unexpected error:", err);
  process.exitCode = 1;
});

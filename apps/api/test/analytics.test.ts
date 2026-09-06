import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { apiEnvSchema } from "@pl/config";
import { assets, markets, oracleAssets, tokens, trades } from "@pl/database";

import {
  buildCommunityAnalytics,
  buildWalletLeaderboard,
  type AnalyticsRow,
} from "../src/analytics.js";
import { buildServer } from "../src/server.js";
import { testDatabase } from "./database.js";

const tokenA = `0x${"11".repeat(20)}`;
const tokenB = `0x${"22".repeat(20)}`;
const usdg = `0x${"33".repeat(20)}`;
const resolver = `0x${"44".repeat(20)}`;
const feed = `0x${"45".repeat(20)}`;
const marketA = `0x${"55".repeat(20)}`;
const walletA = `0x${"66".repeat(20)}`;
const walletB = `0x${"77".repeat(20)}`;
const walletUnknown = `0x${"88".repeat(20)}`;
const now = new Date("2026-09-05T12:00:00.000Z");

function row(changes: Partial<AnalyticsRow> = {}): AnalyticsRow {
  return {
    chainId: 46630,
    tokenAddress: tokenA,
    tokenSymbol: "TOKA",
    tokenName: "Token A",
    tokenDecimals: 18,
    tokenLogoUrl: null,
    marketChainId: 46630,
    marketAddress: marketA,
    marketSlug: "market-a",
    question: "Will A happen?",
    status: "RESOLVED",
    winningOutcome: "YES",
    feeBps: 0,
    yesPool: "100",
    noPool: "50",
    resolvedAt: now,
    wallet: walletA,
    side: "YES",
    amountUsdg: "100",
    timestamp: new Date("2026-09-04T12:00:00.000Z"),
    ...changes,
  };
}

describe("community analytics", () => {
  it("reproduces source-token volume, split, PnL, hit rate, and wallet ranking", () => {
    const rows = [
      row(),
      row({ wallet: walletB, side: "NO", amountUsdg: "50" }),
      row({ tokenAddress: tokenB, tokenSymbol: "TOKB", wallet: walletA, amountUsdg: "25" }),
    ];
    const first = buildCommunityAnalytics(rows);
    const second = buildCommunityAnalytics(structuredClone(rows));
    expect(second).toEqual(first);
    expect(first).toHaveLength(2);
    expect(first[0]).toMatchObject({
      tokenAddress: tokenA,
      volumeUsdg: "150",
      participantCount: 2,
      marketCount: 1,
      resolvedMarkets: 1,
      wins: 1,
      losses: 1,
      hitRateBps: 5000,
      realizedPnlUsdg: "0",
    });
    expect(first[0]?.markets[0]).toMatchObject({
      yesVolumeUsdg: "100",
      noVolumeUsdg: "50",
      yesShareBps: 6666,
    });
    expect(buildWalletLeaderboard(rows)[0]).toMatchObject({
      address: walletA,
      volumeUsdg: "125",
      wins: 1,
    });
  });
});

describe("analytics API", () => {
  let storage: Awaited<ReturnType<typeof testDatabase>>;
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeEach(async () => {
    storage = await testDatabase();
    await storage.db.insert(tokens).values({
      chainId: 46630,
      address: tokenA,
      symbol: "TOKA",
      name: "Token A",
      decimals: 18,
      metadataStatus: "OK",
    });
    await storage.db.insert(assets).values({
      chainId: 46630,
      address: tokenA,
      symbol: "TOKA",
      name: "Token A",
      decimals: 18,
    });
    await storage.db.insert(oracleAssets).values({
      chainId: 46630,
      address: tokenA,
      feedAddress: feed,
      heartbeatSeconds: 86_400,
      feedDecimals: 8,
    });
    await storage.db.insert(markets).values({
      chainId: 46630,
      address: marketA,
      slug: "market-a",
      question: "Will A happen?",
      template: "PRICE_ABOVE_AT_TIME",
      comparator: "PRICE_ABOVE_AT_TIME",
      strike: "1",
      strikeDecimals: 18,
      collateralChainId: 46630,
      collateralAddress: usdg,
      oracleAssetChainId: 46630,
      oracleAssetAddress: tokenA,
      resolver,
      feeBps: 0,
      openTime: new Date("2026-01-01T00:00:00.000Z"),
      lockTime: new Date("2026-02-01T00:00:00.000Z"),
      resolutionTime: new Date("2026-03-01T00:00:00.000Z"),
      gracePeriodSeconds: 60,
      minEntry: "1",
      status: "RESOLVED",
      winningOutcome: "YES",
      yesPool: "100",
      noPool: "50",
      resolvedAt: now,
    });
    await storage.db.insert(trades).values([
      {
        chainId: 46630,
        txHash: `0x${"01".repeat(32)}`,
        logIndex: 0,
        marketChainId: 46630,
        marketAddress: marketA,
        wallet: walletA,
        side: "YES",
        amountUsdg: "100",
        fundingTokenChainId: 46630,
        fundingTokenAddress: tokenA,
        fundingAmount: "1",
        attribution: "SESSION_CORRELATED",
        timestamp: now,
      },
      {
        chainId: 46630,
        txHash: `0x${"02".repeat(32)}`,
        logIndex: 0,
        marketChainId: 46630,
        marketAddress: marketA,
        wallet: walletUnknown,
        side: "NO",
        amountUsdg: "9999",
        attribution: "UNKNOWN",
        timestamp: now,
      },
    ]);
    app = await buildServer({
      env: apiEnvSchema.parse({ DATABASE_URL: "fixture", USDG_ADDRESS: usdg }),
      db: storage.db,
      sql: storage.client,
      redis: null,
    });
  });

  afterEach(async () => {
    await app?.close();
    await storage?.close();
  });

  it("serves directory, detail, market splits, leaderboard, and profile from verified rows only", async () => {
    const marketsDirectory = await app.inject({ method: "GET", url: "/v1/markets" });
    expect(marketsDirectory.statusCode, marketsDirectory.body).toBe(200);
    expect(marketsDirectory.json().markets[0]).toMatchObject({
      chainId: 46630,
      assetSymbol: "TOKA",
      feed,
    });

    const directory = await app.inject({ method: "GET", url: "/v1/communities?window=all" });
    expect(directory.statusCode, directory.body).toBe(200);
    expect(directory.json().communities[0]).toMatchObject({
      volumeUsdg: "100",
      participantCount: 1,
    });

    const detail = await app.inject({ method: "GET", url: `/v1/communities/46630/${tokenA}` });
    expect(detail.statusCode, detail.body).toBe(200);
    expect(detail.json().community.markets[0].noVolumeUsdg).toBe("0");

    const splits = await app.inject({
      method: "GET",
      url: `/v1/communities/46630/${tokenA}/markets`,
    });
    expect(splits.statusCode, splits.body).toBe(200);
    expect(splits.json().markets).toHaveLength(1);

    const marketSplits = await app.inject({
      method: "GET",
      url: `/v1/markets/${marketA}/community-splits`,
    });
    expect(marketSplits.statusCode, marketSplits.body).toBe(200);
    expect(marketSplits.json().splits[0].fundingToken.address).toBe(tokenA);

    const leaderboard = await app.inject({
      method: "GET",
      url: "/v1/leaderboard?metric=pnl&window=all",
    });
    expect(leaderboard.statusCode, leaderboard.body).toBe(200);
    expect(leaderboard.json().entries.map((entry: { address: string }) => entry.address)).toEqual([
      walletA,
    ]);

    const profile = await app.inject({ method: "GET", url: `/v1/profiles/${walletA}` });
    expect(profile.statusCode, profile.body).toBe(200);
    expect(profile.json().profile.communities[0].tokenAddress).toBe(tokenA);
  });
});

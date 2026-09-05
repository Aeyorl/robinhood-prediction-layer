import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  TransactionReceiptNotFoundError,
  type Address,
  type Log,
  type Transaction,
  type TransactionReceipt,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { apiEnvSchema } from "@pl/config";
import { attributionMessage } from "@pl/types";
import { binaryPoolMarketAbi, predictionEntryRouterAbi } from "@pl/sdk";
import { markets, quotes } from "@pl/database";
import { createFundingService } from "../src/funding.js";
import { buildServer } from "../src/server.js";
import { processBlock, rollbackProjections } from "../../worker/src/projections.js";
import { testDatabase } from "./database.js";

const account = privateKeyToAccount(`0x${"01".padStart(64, "0")}`);
const wallet = account.address.toLowerCase() as Address;
const token = `0x${"11".repeat(20)}` as Address;
const usdg = `0x${"22".repeat(20)}` as Address;
const market = `0x${"33".repeat(20)}` as Address;
const adapter = `0x${"44".repeat(20)}` as Address;
const swapHash = `0x${"55".repeat(32)}` as const;
const entryHash = `0x${"66".repeat(32)}` as const;
const blockHash = `0x${"77".repeat(32)}` as const;
const quoteId = "00000000-0000-4000-8000-000000000001";
const input = {
  wallet,
  quoteId,
  fundingToken: token,
  fundingAmount: "100",
  swapTxHash: swapHash,
  enterTxHash: entryHash,
};
const entryLog = {
  address: market,
  topics: encodeEventTopics({
    abi: binaryPoolMarketAbi,
    eventName: "PositionEntered",
    args: { user: wallet, side: 1 },
  }),
  data: encodeAbiParameters(
    [{ type: "uint8" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
    [1, 120n, 120n, 0n],
  ),
  blockNumber: 12n,
  blockHash,
  transactionHash: entryHash,
  transactionIndex: 0,
  logIndex: 0,
  removed: false,
} as Log;
const swapLog = {
  ...entryLog,
  address: usdg,
  transactionHash: swapHash,
  topics: encodeEventTopics({
    abi: erc20Abi,
    eventName: "Transfer",
    args: { from: adapter, to: wallet },
  }),
  data: encodeAbiParameters([{ type: "uint256" }], [120n]),
} as Log;
const routedLog = {
  ...entryLog,
  address: token,
  topics: encodeEventTopics({
    abi: predictionEntryRouterAbi,
    eventName: "FundingRouted",
    args: { user: wallet, market, fundingToken: token },
  }),
  data: encodeAbiParameters(
    [{ type: "uint256" }, { type: "uint256" }, { type: "uint8" }],
    [100n, 120n, 1],
  ),
  logIndex: 1,
} as Log;

describe("signed attribution and indexer timing", () => {
  let storage: Awaited<ReturnType<typeof testDatabase>>;
  let service: ReturnType<typeof createFundingService>;
  let app: Awaited<ReturnType<typeof buildServer>>;
  beforeEach(async () => {
    storage = await testDatabase();
    const env = apiEnvSchema.parse({
      DATABASE_URL: "fixture",
      USDG_ADDRESS: usdg,
      MOCK_SWAP_ADAPTER_ADDRESS: adapter,
    });
    service = createFundingService(env);
    vi.spyOn(service.client, "getChainId").mockResolvedValue(46630);
    vi.spyOn(service.client, "verifyMessage").mockImplementation(
      async ({ address, message, signature }) => {
        const { verifyMessage } = await import("viem");
        return verifyMessage({ address, message, signature });
      },
    );
    vi.spyOn(service.client, "getTransaction").mockImplementation(
      async ({ hash }) =>
        ({
          hash,
          from: wallet,
          to: hash === swapHash ? adapter : market,
          input: hash === swapHash ? "0x1234" : "0x5678",
          value: 0n,
        }) as unknown as Transaction,
    );
    vi.spyOn(service.client, "getTransactionReceipt").mockImplementation(
      async ({ hash }) =>
        ({
          status: "success",
          transactionHash: hash,
          blockNumber: hash === swapHash ? 11n : 12n,
          transactionIndex: 0,
          logs: hash === swapHash ? [swapLog] : [entryLog],
        }) as unknown as TransactionReceipt,
    );
    vi.spyOn(service.client, "getBlock").mockResolvedValue({ timestamp: 1000n } as Awaited<
      ReturnType<typeof service.client.getBlock>
    >);
    await storage.db.insert(markets).values({
      chainId: 46630,
      address: market,
      slug: "fixture",
      question: "Test?",
      template: "PRICE_ABOVE_AT_TIME",
      comparator: "PRICE_ABOVE_AT_TIME",
      strike: "1",
      strikeDecimals: 18,
      collateralChainId: 46630,
      collateralAddress: usdg,
      oracleAssetChainId: 46630,
      oracleAssetAddress: token,
      resolver: adapter,
      feeBps: 0,
      openTime: new Date(0),
      lockTime: new Date(2000000),
      resolutionTime: new Date(3000000),
      gracePeriodSeconds: 60,
      minEntry: "1",
    });
    await storage.db.insert(quotes).values({
      quoteId,
      chainId: 46630,
      adapter: "mock",
      wallet,
      tokenIn: token,
      usdgAddress: usdg,
      amountIn: "100",
      amountOut: "120",
      minAmountOut: "119",
      slippageBps: 100,
      expiresAt: new Date(1100000),
      routeSummary: { market, swapPlan: { to: adapter, data: "0x1234" } },
    });
    app = await buildServer({
      env,
      db: storage.db,
      sql: storage.client,
      redis: null,
      funding: service,
    });
  });
  afterEach(async () => {
    await app?.close();
    await storage?.close();
    vi.restoreAllMocks();
  });
  async function submit(changes = {}) {
    const payload = { ...input, ...changes };
    const signature = await account.signMessage({ message: attributionMessage(46630, payload) });
    return app.inject({
      method: "POST",
      url: "/v1/trades/attribution",
      payload: { ...payload, signature },
    });
  }
  async function index() {
    vi.spyOn(service.client, "getLogs").mockImplementation(async (args) =>
      !args || "event" in args || !Array.isArray(args.address) ? [] : [entryLog],
    );
    return processBlock(
      {
        db: storage.db,
        client: service.client,
        chainId: 46630,
        factoryAddress: adapter,
        marketAddresses: new Set([market]),
      },
      { number: 12n, hash: blockHash, timestamp: 1000n },
    );
  }
  it("applies correlation when the browser posts before indexing", async () => {
    const response = await submit();
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().status).toBe("PENDING");
    await index();
    expect((await storage.db.query.trades.findFirst())?.attribution).toBe("SESSION_CORRELATED");
  });
  it("prefers atomic router attribution proven in the entry transaction", async () => {
    vi.spyOn(service.client, "getLogs").mockImplementation(async (args) => {
      if (!args || "event" in args) return [];
      if (args.address === token) return [routedLog];
      return Array.isArray(args.address) ? [entryLog] : [];
    });
    await processBlock(
      {
        db: storage.db,
        client: service.client,
        chainId: 46630,
        factoryAddress: adapter,
        entryRouterAddress: token,
        marketAddresses: new Set([market]),
      },
      { number: 12n, hash: blockHash, timestamp: 1000n },
    );
    expect(await storage.db.query.trades.findFirst()).toMatchObject({
      attribution: "ONCHAIN",
      fundingTokenAddress: token,
      fundingAmount: "100",
    });
  });
  it("updates already indexed trades and makes a signed replay idempotent", async () => {
    await index();
    expect((await storage.db.query.trades.findFirst())?.attribution).toBe("UNKNOWN");
    const response = await submit();
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().status).toBe("CONFIRMED");
    expect((await submit()).statusCode).toBe(200);
    expect(await storage.db.query.tradeAttributions.findMany()).toHaveLength(1);
    await rollbackProjections(storage.client, 46630, 12n);
    expect((await storage.db.query.tradeAttributions.findFirst())?.status).toBe("PENDING");
    await index();
    expect((await storage.db.query.trades.findFirst())?.attribution).toBe("SESSION_CORRELATED");
  });
  it("rejects forged wallet ownership and quote mismatches", async () => {
    expect((await submit({ wallet: token })).statusCode).toBe(401);
    expect((await submit({ fundingAmount: "101" })).statusCode).toBe(400);
  });
  it("rejects a reverted swap", async () => {
    vi.mocked(service.client.getTransactionReceipt).mockResolvedValue({
      status: "reverted",
      blockNumber: 11n,
      transactionIndex: 0,
      logs: [],
    } as unknown as TransactionReceipt);
    expect((await submit()).statusCode).toBe(400);
  });
  it("rejects a swap included after quote expiry", async () => {
    vi.mocked(service.client.getBlock).mockResolvedValue({ timestamp: 1200n } as Awaited<
      ReturnType<typeof service.client.getBlock>
    >);
    expect((await submit()).statusCode).toBe(400);
  });
  it("rejects a receipt that does not prove collateral received", async () => {
    vi.mocked(service.client.getTransactionReceipt).mockImplementation(
      async ({ hash }) =>
        ({
          status: "success",
          transactionHash: hash,
          blockNumber: hash === swapHash ? 11n : 12n,
          transactionIndex: 0,
          logs: hash === swapHash ? [] : [entryLog],
        }) as unknown as TransactionReceipt,
    );
    expect((await submit()).statusCode).toBe(400);
  });
  it("does not restore attribution if a reorg orphaned the swap", async () => {
    expect((await submit()).statusCode).toBe(200);
    vi.mocked(service.client.getTransactionReceipt).mockRejectedValue(
      new TransactionReceiptNotFoundError({ hash: swapHash }),
    );
    await index();
    expect((await storage.db.query.trades.findFirst())?.attribution).toBe("UNKNOWN");
    expect((await storage.db.query.tradeAttributions.findFirst())?.rejectionReason).toBe(
      "swap_not_canonical",
    );
  });
});

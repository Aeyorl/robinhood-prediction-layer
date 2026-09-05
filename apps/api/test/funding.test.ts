import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeFunctionData, getAddress } from "viem";
import { apiEnvSchema } from "@pl/config";
import { mockSwapAdapterAbi } from "@pl/sdk";
import { quoteRequestSchema, uint256DecimalSchema } from "@pl/types";
import { createFundingService } from "../src/funding.js";
import { buildServer } from "../src/server.js";

const token = `0x${"11".repeat(20)}` as const;
const usdg = `0x${"22".repeat(20)}` as const;
const adapter = `0x${"33".repeat(20)}` as const;
const wallet = `0x${"44".repeat(20)}` as const;
const router = `0x${"55".repeat(20)}` as const;
const input = { tokenIn: token, amountIn: "1000000000000000000", wallet };
function setup(overrides: Record<string, unknown> = {}, request?: typeof fetch) {
  const env = apiEnvSchema.parse({
    DATABASE_URL: "postgres://unused",
    USDG_ADDRESS: usdg,
    MOCK_SWAP_ADAPTER_ADDRESS: adapter,
    ...overrides,
  });
  const service = createFundingService(env, request);
  vi.spyOn(service.client, "getChainId").mockResolvedValue(env.CHAIN_ID);
  vi.spyOn(service.client, "getCode").mockResolvedValue("0x1234");
  vi.spyOn(service.client, "readContract").mockImplementation(async (args) =>
    args.functionName === "usdg"
      ? usdg
      : args.functionName === "decimals"
        ? 18
        : args.functionName === "quote"
          ? 120n * 10n ** 18n
          : 1_000_000n * 10n ** 18n,
  );
  return { env, service };
}
afterEach(() => vi.restoreAllMocks());

describe("funding quote policy", () => {
  it("binds mock calldata to wallet, exact input and minimum output", async () => {
    const { service } = setup();
    const q = await service.quote(input);
    expect(q.usdg).toBe(usdg);
    expect(q.approvalSpender).toBe(adapter);
    expect(q.minAmountOut).toBe("118800000000000000000");
    const decoded = decodeFunctionData({
      abi: mockSwapAdapterAbi,
      data: q.swapPlan.data as `0x${string}`,
    });
    expect(decoded.functionName).toBe("swap");
    expect(decoded.args).toEqual([token, 10n ** 18n, 118800000000000000000n, wallet]);
  });
  it("routes approval and swap output through the atomic entry router", async () => {
    const { service } = setup({ PREDICTION_ENTRY_ROUTER_ADDRESS: router });
    const q = await service.quote(input);
    expect(q.approvalSpender).toBe(router);
    expect(q.entryRouter).toBe(router);
    expect(q.swapPlan.to).toBe(adapter);
    const decoded = decodeFunctionData({
      abi: mockSwapAdapterAbi,
      data: q.swapPlan.data as `0x${string}`,
    });
    expect(decoded.args).toEqual([token, 10n ** 18n, 118800000000000000000n, router]);
  });
  it.each(["0", "-1", "1e18", (2n ** 256n).toString(), "1".repeat(1000)])(
    "rejects invalid amount %s",
    async (amount) => {
      if (amount === "0")
        await expect(setup().service.quote({ ...input, amountIn: amount })).rejects.toMatchObject({
          code: "invalid_amount",
        });
      else expect(uint256DecimalSchema.safeParse(amount).success).toBe(false);
    },
  );
  it("requires a recipient wallet", () =>
    expect(quoteRequestSchema.safeParse({ tokenIn: token, amountIn: "1" }).success).toBe(false));
  it("refuses mocks on mainnet", async () =>
    await expect(setup({ CHAIN_ID: 4663 }).service.quote(input)).rejects.toMatchObject({
      code: "adapter_unavailable",
    }));
  it("refuses blocked tokens", async () =>
    await expect(
      setup({ BLOCKED_TOKEN_ADDRESSES: token }).service.quote(input),
    ).rejects.toMatchObject({ code: "unsupported_token" }));
  it("refuses an RPC on another chain", async () => {
    const { service } = setup();
    vi.mocked(service.client.getChainId).mockResolvedValue(1);
    await expect(service.quote(input)).rejects.toMatchObject({ code: "rpc_chain_mismatch" });
  });
  it("refuses an adapter with the wrong collateral", async () => {
    const { service } = setup();
    vi.mocked(service.client.readContract).mockResolvedValue(token);
    await expect(service.quote(input)).rejects.toMatchObject({ code: "noncanonical_collateral" });
  });
  it("does not quote unfunded mock liquidity", async () => {
    const { service } = setup();
    vi.mocked(service.client.readContract).mockImplementation(async (args) =>
      args.functionName === "usdg"
        ? usdg
        : args.functionName === "decimals"
          ? 18
          : args.functionName === "quote"
            ? 120n * 10n ** 18n
            : 0n,
    );
    await expect(service.quote(input)).rejects.toMatchObject({ code: "no_route" });
  });
  it("rejects client-selected routers and chains at the HTTP boundary", async () => {
    const { env, service } = setup();
    const app = await buildServer({ env, funding: service, db: null, sql: null, redis: null });
    const response = await app.inject({
      method: "POST",
      url: "/v1/quotes",
      payload: { ...input, chainId: 1, router: adapter },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });
  it("rate limits quote requests even without Redis", async () => {
    const { env, service } = setup();
    const app = await buildServer({ env, funding: service, db: null, sql: null, redis: null });
    for (let i = 0; i < 20; i++)
      await app.inject({ method: "POST", url: "/v1/quotes", payload: input });
    expect(
      (await app.inject({ method: "POST", url: "/v1/quotes", payload: input })).statusCode,
    ).toBe(429);
    await app.close();
  });
});

describe("Uniswap adapter contract (fixture responses, not live routing evidence)", () => {
  const canonical = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
  function upstream(
    changes: Record<string, unknown> = {},
    transaction: Record<string, unknown> = {},
  ) {
    return vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            routing: "CLASSIC",
            permitData: null,
            quote: {
              chainId: 4663,
              swapper: wallet,
              input: { token, amount: input.amountIn, maximumAmount: input.amountIn },
              output: {
                token: canonical,
                amount: "120000000000000000000",
                minimumAmount: "118800000000000000000",
                recipient: wallet,
              },
              priceImpact: 0.5,
              slippage: 1,
              ...changes,
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            swap: {
              to: adapter,
              from: wallet,
              data: "0x12345678",
              value: "0",
              chainId: 4663,
              ...transaction,
            },
          }),
        ),
      );
  }
  function uniswap(request: typeof fetch) {
    return setup(
      {
        CHAIN_ID: 4663,
        SWAP_ADAPTER: "uniswap",
        USDG_ADDRESS: canonical,
        UNISWAP_PROXY_ADDRESS: adapter,
        UNISWAP_API_KEY: "fixture-only",
      },
      request,
    );
  }
  it("accepts the provider-selected official legacy proxy", async () => {
    const legacy = "0x02E5be68D46DAc0B524905bfF209cf47EE6dB2a9";
    const request = upstream({}, { to: legacy, value: "0x00" });
    const { service } = setup(
      {
        CHAIN_ID: 4663,
        SWAP_ADAPTER: "uniswap",
        USDG_ADDRESS: canonical,
        UNISWAP_API_KEY: "fixture-only",
      },
      request,
    );
    expect((await service.quote(input)).approvalSpender).toBe(legacy.toLowerCase());
  });
  it("pins chain, recipient, collateral and slippage in the provider request", async () => {
    const request = upstream();
    const { service } = uniswap(request);
    const q = await service.quote(input);
    expect(q.adapter).toBe("uniswap");
    expect(q.priceImpactBps).toBe("50");
    const body = JSON.parse(request.mock.calls[0]![1]!.body as string);
    expect(body).toMatchObject({
      tokenOut: getAddress(canonical),
      tokenInChainId: 4663,
      recipient: wallet,
      slippageTolerance: 1,
    });
    const swapBody = JSON.parse(request.mock.calls[1]![1]!.body as string);
    expect(swapBody.quote).toMatchObject({
      input: { maximumAmount: input.amountIn },
      output: { minimumAmount: "118800000000000000000", recipient: wallet },
    });
  });
  it.each([
    { chainId: 1 },
    { swapper: token },
    { output: { token: usdg, amount: "10" } },
    { slippage: 50 },
    { portionAmount: "1" },
  ])("refuses altered provider bindings %j", async (change) => {
    await expect(uniswap(upstream(change)).service.quote(input)).rejects.toMatchObject({
      code: "invalid_provider_quote",
    });
  });
  it("rejects excessive price impact", async () =>
    await expect(uniswap(upstream({ priceImpact: 4 })).service.quote(input)).rejects.toMatchObject({
      code: "high_price_impact",
    }));
  it("derives the default 0.01 USDG dust threshold from onchain decimals", async () => {
    const { service } = uniswap(upstream({ output: { token: canonical, amount: "9999" } }));
    vi.mocked(service.client.readContract).mockImplementation(async (args) =>
      args.functionName === "decimals" ? 6 : 1_000_000n,
    );
    await expect(service.quote(input)).rejects.toMatchObject({ code: "dust" });
  });
  it.each([{ to: token }, { from: token }, { value: "1" }, { chainId: 1 }])(
    "refuses unsafe transaction %j",
    async (change) => {
      await expect(uniswap(upstream({}, change)).service.quote(input)).rejects.toMatchObject({
        code: "invalid_provider_transaction",
      });
    },
  );
  it("maps missing liquidity to no_route", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 404 }));
    await expect(uniswap(request).service.quote(input)).rejects.toMatchObject({ code: "no_route" });
  });
});

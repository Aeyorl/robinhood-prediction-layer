import { randomUUID } from "node:crypto";
import { getChainAddresses } from "@pl/chain-config";
import type { ApiEnv } from "@pl/config";
import { mockSwapAdapterAbi } from "@pl/sdk";
import {
  quoteResponseSchema,
  swapPlanSchema,
  uint256DecimalSchema,
  type QuoteRequest,
  type QuoteResponse,
} from "@pl/types";
import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  http,
  zeroAddress,
  type Address,
} from "viem";
import { z } from "zod";

export class FundingError extends Error {
  constructor(
    public code: string,
    public status = 422,
  ) {
    super(code);
  }
}

const upstreamQuoteSchema = z.object({
  routing: z.literal("CLASSIC"),
  permitData: z.unknown().nullish(),
  quote: z
    .object({
      chainId: z.number(),
      swapper: z.string(),
      input: z.object({ token: z.string(), amount: uint256DecimalSchema }).passthrough(),
      output: z.object({ token: z.string(), amount: uint256DecimalSchema }).passthrough(),
      priceImpact: z.number().finite(),
      slippage: z.number().finite(),
      portionAmount: uint256DecimalSchema.optional(),
      txFailureReasons: z.array(z.string()).optional(),
    })
    .passthrough(),
});

/** Official current and immutable legacy proxies used by Uniswap's approval flow. */
export const UNISWAP_PROXY_ADDRESS = "0x0000000085E102724e78eCd2F45DC9cA239Affad" as const;
export const UNISWAP_LEGACY_PROXY_ADDRESS = "0x02E5be68D46DAc0B524905bfF209cf47EE6dB2a9" as const;

const upstreamSwapSchema = z.object({
  swap: z.object({
    to: z.string(),
    from: z.string(),
    data: swapPlanSchema.shape.data,
    value: z.string().regex(/^(?:0x[0-9a-fA-F]+|\d+)$/),
    chainId: z.number(),
  }),
});

export function createFundingService(env: ApiEnv, request: typeof fetch = fetch) {
  const client = createPublicClient({
    transport: http(env.RPC_HTTP_URL, { timeout: env.RPC_TIMEOUT_MS, retryCount: 1 }),
  });
  const usdg = (env.USDG_ADDRESS ?? getChainAddresses(env.CHAIN_ID).usdg)?.toLowerCase() as
    Address | undefined;
  const mockSpender = env.MOCK_SWAP_ADAPTER_ADDRESS?.toLowerCase() as Address | undefined;
  const entryRouter = env.PREDICTION_ENTRY_ROUTER_ADDRESS?.toLowerCase() as Address | undefined;
  const uniswapSpenders = (
    env.UNISWAP_PROXY_ADDRESS
      ? [env.UNISWAP_PROXY_ADDRESS]
      : [UNISWAP_PROXY_ADDRESS, UNISWAP_LEGACY_PROXY_ADDRESS]
  ).map((address) => address.toLowerCase() as Address);
  const allowedSpenders =
    env.SWAP_ADAPTER === "mock" ? (mockSpender ? [mockSpender] : []) : uniswapSpenders;
  const spender = allowedSpenders[0];

  async function ready() {
    if (
      !usdg ||
      !spender ||
      usdg === zeroAddress ||
      spender === zeroAddress ||
      (env.SWAP_ADAPTER === "mock" && env.CHAIN_ID !== 46630) ||
      (env.SWAP_ADAPTER === "uniswap" && (env.CHAIN_ID !== 4663 || !env.UNISWAP_API_KEY))
    ) {
      throw new FundingError("adapter_unavailable", 503);
    }
    if (env.CHAIN_ID === 4663 && usdg !== getChainAddresses(4663).usdg?.toLowerCase())
      throw new FundingError("noncanonical_collateral", 503);
    if ((await client.getChainId()) !== env.CHAIN_ID)
      throw new FundingError("rpc_chain_mismatch", 503);
    for (const allowedSpender of allowedSpenders) {
      const code = await client.getCode({ address: allowedSpender });
      if (!code || code === "0x") throw new FundingError("adapter_unavailable", 503);
    }
    if (entryRouter) {
      const code = await client.getCode({ address: entryRouter });
      if (!code || code === "0x") throw new FundingError("adapter_unavailable", 503);
    }
    if (env.SWAP_ADAPTER === "mock") {
      const actual = (await client.readContract({
        address: spender,
        abi: mockSwapAdapterAbi,
        functionName: "usdg",
      })) as string;
      if (actual.toLowerCase() !== usdg) throw new FundingError("noncanonical_collateral", 503);
    }
    const usdgDecimals = await client.readContract({
      address: usdg,
      abi: erc20Abi,
      functionName: "decimals",
    });
    if (usdgDecimals > 77) throw new FundingError("noncanonical_collateral", 503);
    return { usdg, spender, allowedSpenders, usdgDecimals, entryRouter };
  }

  async function post(path: string, body: unknown): Promise<unknown> {
    const response = await request(`${env.UNISWAP_API_URL}/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.UNISWAP_API_KEY!,
        "x-permit2-disabled": "true",
        "x-universal-router-version": "2.1.1",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
      throw new FundingError(
        response.status === 404 ? "no_route" : "adapter_unavailable",
        response.status === 404 ? 422 : 503,
      );
    return response.json();
  }

  async function quote(input: QuoteRequest): Promise<QuoteResponse> {
    const { usdg, spender, allowedSpenders, usdgDecimals, entryRouter } = await ready();
    const tokenIn = input.tokenIn.toLowerCase() as Address;
    const wallet = input.wallet.toLowerCase() as Address;
    const swapper = entryRouter ?? wallet;
    const amount = BigInt(input.amountIn);
    if (amount <= 0n) throw new FundingError("invalid_amount", 400);
    if (
      tokenIn === usdg ||
      tokenIn === zeroAddress ||
      env.BLOCKED_TOKEN_ADDRESSES.includes(tokenIn)
    )
      throw new FundingError("unsupported_token");
    const expiresAt = Date.now() + env.QUOTE_TTL_SECONDS * 1000;
    let amountOut: bigint;
    let priceImpactBps = "0";
    let swapPlan: QuoteResponse["swapPlan"];
    let approvalSpender = entryRouter ?? spender;
    if (env.SWAP_ADAPTER === "mock") {
      try {
        amountOut = (await client.readContract({
          address: spender,
          abi: mockSwapAdapterAbi,
          functionName: "quote",
          args: [tokenIn, amount],
        })) as bigint;
      } catch {
        throw new FundingError("no_route");
      }
      const liquidity = await client.readContract({
        address: usdg,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [spender],
      });
      if (liquidity < amountOut) throw new FundingError("no_route");
      const min = (amountOut * BigInt(10_000 - env.MAX_SLIPPAGE_BPS)) / 10_000n;
      swapPlan = {
        to: spender,
        value: "0",
        data: encodeFunctionData({
          abi: mockSwapAdapterAbi,
          functionName: "swap",
          args: [tokenIn, amount, min, swapper],
        }),
      };
    } else {
      const providerTokenIn = getAddress(tokenIn);
      const providerUsdg = getAddress(usdg);
      const providerWallet = getAddress(swapper);
      const parsed = upstreamQuoteSchema.safeParse(
        await post("quote", {
          type: "EXACT_INPUT",
          amount: amount.toString(),
          tokenInChainId: env.CHAIN_ID,
          tokenOutChainId: env.CHAIN_ID,
          tokenIn: providerTokenIn,
          tokenOut: providerUsdg,
          swapper: providerWallet,
          recipient: providerWallet,
          slippageTolerance: env.MAX_SLIPPAGE_BPS / 100,
          protocols: ["V2", "V3"],
          routingPreference: "BEST_PRICE",
        }),
      );
      if (!parsed.success) throw new FundingError("invalid_provider_quote", 502);
      const { quote: q, permitData } = parsed.data;
      if (
        permitData != null ||
        q.chainId !== env.CHAIN_ID ||
        q.swapper.toLowerCase() !== swapper ||
        q.input.token.toLowerCase() !== tokenIn ||
        BigInt(q.input.amount) !== amount ||
        q.output.token.toLowerCase() !== usdg ||
        q.slippage !== env.MAX_SLIPPAGE_BPS / 100 ||
        BigInt(q.portionAmount ?? "0") !== 0n ||
        q.txFailureReasons?.length
      )
        throw new FundingError("invalid_provider_quote", 502);
      if (Math.abs(q.priceImpact) * 100 > env.MAX_PRICE_IMPACT_BPS)
        throw new FundingError("high_price_impact");
      priceImpactBps = String(Math.abs(q.priceImpact) * 100);
      amountOut = BigInt(q.output.amount);
      const result = upstreamSwapSchema.safeParse(await post("swap", { quote: q }));
      if (
        !result.success ||
        !allowedSpenders.includes(result.data.swap.to.toLowerCase() as Address) ||
        result.data.swap.chainId !== env.CHAIN_ID ||
        result.data.swap.from.toLowerCase() !== swapper ||
        BigInt(result.data.swap.value) !== 0n
      )
        throw new FundingError("invalid_provider_transaction", 502);
      const swapTarget = result.data.swap.to.toLowerCase() as Address;
      approvalSpender = entryRouter ?? swapTarget;
      swapPlan = { to: swapTarget, data: result.data.swap.data, value: "0" };
    }
    const dustThreshold = env.DUST_THRESHOLD_USDG
      ? BigInt(env.DUST_THRESHOLD_USDG)
      : 10n ** BigInt(Math.max(0, usdgDecimals - 2));
    if (amountOut < dustThreshold || amountOut <= 0n) throw new FundingError("dust");
    if (Date.now() >= expiresAt) throw new FundingError("quote_expired");
    return quoteResponseSchema.parse({
      quoteId: randomUUID(),
      chainId: env.CHAIN_ID,
      adapter: env.SWAP_ADAPTER,
      tokenIn,
      usdg,
      amountIn: amount.toString(),
      amountOut: amountOut.toString(),
      minAmountOut: ((amountOut * BigInt(10_000 - env.MAX_SLIPPAGE_BPS)) / 10_000n).toString(),
      slippageBps: env.MAX_SLIPPAGE_BPS,
      priceImpactBps,
      expiresAt,
      routeSummary:
        env.SWAP_ADAPTER === "mock"
          ? "Local/testnet deterministic swap"
          : "Uniswap V2/V3 via verified proxy",
      swapPlan,
      approvalSpender,
      entryRouter: entryRouter ?? null,
    });
  }
  return { client, usdg, ready, quote };
}

export type FundingService = ReturnType<typeof createFundingService>;

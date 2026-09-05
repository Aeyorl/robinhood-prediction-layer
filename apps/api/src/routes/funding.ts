import type { FastifyPluginAsync } from "fastify";
import { and, eq, or, sql } from "drizzle-orm";
import { erc20Abi, parseEventLogs, type Address, type Hash } from "viem";
import { z } from "zod";
import { markets, quotes, tokens, tokenTransfers, tradeAttributions, trades } from "@pl/database";
import {
  addressSchema,
  attributionMessage,
  attributionRequestSchema,
  quoteRequestSchema,
  type AssetBalance,
} from "@pl/types";
import { binaryPoolMarketAbi } from "@pl/sdk";
import { createFundingService, FundingError } from "../funding.js";
import type { ServerDeps } from "../server.js";

export const fundingRoutes: FastifyPluginAsync<ServerDeps> = async (app, deps) => {
  const service = deps.funding ?? createFundingService(deps.env);
  const chainId = deps.env.CHAIN_ID;
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof FundingError) return reply.code(error.status).send({ error: error.code });
    if (
      error &&
      typeof error === "object" &&
      "statusCode" in error &&
      Number(error.statusCode) >= 400 &&
      Number(error.statusCode) < 500
    )
      return reply
        .code(Number(error.statusCode))
        .send({ error: Number(error.statusCode) === 429 ? "rate_limited" : "invalid_request" });
    app.log.error(error, "funding request failed");
    return reply.code(503).send({ error: "funding_unavailable" });
  });

  app.get("/v1/wallets/:address/trades", async (request, reply) => {
    const parsed = z.object({ address: addressSchema }).safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    if (!deps.db) return reply.code(503).send({ error: "database_unavailable" });
    const rows = await deps.db
      .select()
      .from(trades)
      .where(and(eq(trades.chainId, chainId), eq(trades.wallet, parsed.data.address.toLowerCase())))
      .orderBy(sql`${trades.id} desc`)
      .limit(100);
    return { chainId, trades: rows };
  });

  app.post(
    "/v1/quotes",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = quoteRequestSchema.strict().safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid_request", issues: parsed.error.issues });
      if (!deps.db) return reply.code(503).send({ error: "database_unavailable" });
      const blocked = await deps.db.query.tokens.findFirst({
        where: and(
          eq(tokens.chainId, chainId),
          eq(tokens.address, parsed.data.tokenIn.toLowerCase()),
        ),
      });
      if (
        blocked?.supportStatus === "BLOCKED" ||
        blocked?.supportStatus === "UNSAFE_BEHAVIOR" ||
        blocked?.metadataStatus === "UNREADABLE"
      )
        throw new FundingError("unsupported_token");
      const q = await service.quote(parsed.data);
      await deps.db.insert(quotes).values({
        quoteId: q.quoteId,
        chainId,
        adapter: q.adapter,
        wallet: parsed.data.wallet.toLowerCase(),
        tokenIn: q.tokenIn,
        usdgAddress: q.usdg,
        amountIn: q.amountIn,
        amountOut: q.amountOut,
        minAmountOut: q.minAmountOut,
        slippageBps: q.slippageBps,
        priceImpactBps: q.priceImpactBps,
        expiresAt: new Date(q.expiresAt),
        routeSummary: { ...q, market: parsed.data.market?.toLowerCase() },
      });
      return q;
    },
  );

  app.get(
    "/v1/wallets/:address/assets",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = z.object({ address: addressSchema }).safeParse(request.params);
      const query = z
        .object({ offset: z.coerce.number().int().min(0).max(10000).default(0) })
        .safeParse(request.query);
      if (!parsed.success || !query.success)
        return reply.code(400).send({ error: "invalid_request" });
      const wallet = parsed.data.address.toLowerCase() as Address;
      if (!service.usdg || (await service.client.getChainId()) !== chainId)
        throw new FundingError("rpc_chain_mismatch", 503);
      const candidates = new Set<string>(
        query.data.offset === 0 ? [service.usdg, ...deps.env.KNOWN_TOKEN_ADDRESSES] : [],
      );
      let discovered: { address: string }[] = [];
      if (deps.db) {
        discovered = await deps.db
          .selectDistinct({ address: tokenTransfers.tokenAddress })
          .from(tokenTransfers)
          .where(
            and(
              eq(tokenTransfers.chainId, chainId),
              or(eq(tokenTransfers.toAddress, wallet), eq(tokenTransfers.fromAddress, wallet)),
            ),
          )
          .orderBy(tokenTransfers.tokenAddress)
          .limit(50)
          .offset(query.data.offset);
        for (const row of discovered) candidates.add(row.address);
      }
      const assets: AssetBalance[] = [];
      let quoted = 0;
      for (const candidate of candidates) {
        const address = candidate as Address;
        try {
          const [balance, symbol, name, decimals] = await Promise.all([
            service.client.readContract({
              address,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [wallet],
            }),
            service.client.readContract({ address, abi: erc20Abi, functionName: "symbol" }),
            service.client.readContract({ address, abi: erc20Abi, functionName: "name" }),
            service.client.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
          ]);
          if (balance === 0n) continue;
          const row = deps.db
            ? await deps.db.query.tokens.findFirst({
                where: and(eq(tokens.chainId, chainId), eq(tokens.address, address)),
              })
            : null;
          let supportStatus: AssetBalance["supportStatus"] = "DISCOVERED";
          let usdgEstimate: string | null = null;
          if (
            deps.env.BLOCKED_TOKEN_ADDRESSES.includes(address) ||
            row?.supportStatus === "BLOCKED"
          )
            supportStatus = "BLOCKED";
          else if (row?.supportStatus === "UNSAFE_BEHAVIOR" || row?.metadataStatus === "UNREADABLE")
            supportStatus = "UNSAFE_BEHAVIOR";
          else if (address === service.usdg) {
            supportStatus = "SUPPORTED";
            usdgEstimate = balance.toString();
          } else if (quoted < deps.env.MAX_QUOTED_ASSETS_PER_REQUEST) {
            quoted++;
            try {
              const q = await service.quote({
                tokenIn: address,
                amountIn: balance.toString(),
                wallet,
              });
              supportStatus = "SUPPORTED";
              usdgEstimate = q.amountOut;
            } catch (err) {
              supportStatus =
                err instanceof FundingError
                  ? ((
                      {
                        no_route: "NO_ROUTE",
                        high_price_impact: "HIGH_IMPACT",
                        dust: "DUST",
                        unsupported_token: "UNSAFE_BEHAVIOR",
                      } as const
                    )[err.code as "no_route"] ?? "DISCOVERED")
                  : "DISCOVERED";
            }
          }
          assets.push({
            token: { chainId, address },
            symbol: symbol.slice(0, 40),
            name: name.slice(0, 100),
            decimals,
            balance: balance.toString(),
            usdgEstimate,
            supportStatus,
            updatedAt: Date.now(),
          });
        } catch {
          /* Unreadable metadata/balance is never fabricated or made selectable. */
        }
      }
      return {
        chainId,
        assets,
        discovery: deps.db ? "indexed-and-known-tokens" : "known-tokens-only",
        nextOffset: discovered.length === 50 ? query.data.offset + 50 : null,
      };
    },
  );

  app.post(
    "/v1/trades/attribution",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = attributionRequestSchema.strict().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
      if (!deps.db) return reply.code(503).send({ error: "database_unavailable" });
      const input = parsed.data;
      const wallet = input.wallet.toLowerCase() as Address;
      const enterHash = input.enterTxHash.toLowerCase() as Hash;
      const swapHash = input.swapTxHash.toLowerCase() as Hash;
      if (
        !(await service.client.verifyMessage({
          address: wallet,
          message: attributionMessage(chainId, input),
          signature: input.signature as Hash,
        }))
      )
        return reply.code(401).send({ error: "invalid_signature" });
      const q = await deps.db.query.quotes.findFirst({
        where: and(eq(quotes.chainId, chainId), eq(quotes.quoteId, input.quoteId)),
      });
      if (
        !q ||
        q.wallet !== wallet ||
        q.tokenIn !== input.fundingToken.toLowerCase() ||
        q.amountIn !== input.fundingAmount
      )
        throw new FundingError("quote_mismatch", 400);
      const [swap, enter, swapReceipt, entryReceipt] = await Promise.all([
        service.client.getTransaction({ hash: swapHash }),
        service.client.getTransaction({ hash: enterHash }),
        service.client.getTransactionReceipt({ hash: swapHash }),
        service.client.getTransactionReceipt({ hash: enterHash }),
      ]);
      const plan = q.routeSummary as { swapPlan: { to: string; data: string }; market?: string };
      const swapBlock = await service.client.getBlock({ blockNumber: swapReceipt.blockNumber });
      if (
        (await service.client.getChainId()) !== chainId ||
        swap.from.toLowerCase() !== wallet ||
        enter.from.toLowerCase() !== wallet ||
        swapReceipt.status !== "success" ||
        entryReceipt.status !== "success" ||
        swap.to?.toLowerCase() !== plan.swapPlan.to.toLowerCase() ||
        swap.input.toLowerCase() !== plan.swapPlan.data.toLowerCase() ||
        swap.value !== 0n ||
        Number(swapBlock.timestamp) * 1000 > q.expiresAt.getTime() ||
        swapReceipt.blockNumber > entryReceipt.blockNumber ||
        (swapReceipt.blockNumber === entryReceipt.blockNumber &&
          swapReceipt.transactionIndex >= entryReceipt.transactionIndex)
      )
        throw new FundingError("invalid_receipts", 400);
      const market = await deps.db.query.markets.findFirst({
        where: and(
          eq(markets.chainId, chainId),
          eq(markets.address, enter.to?.toLowerCase() ?? ""),
        ),
      });
      if (
        !market ||
        market.collateralAddress.toLowerCase() !== q.usdgAddress ||
        (plan.market && plan.market !== market.address)
      )
        throw new FundingError("market_mismatch", 400);
      const entries = parseEventLogs({
        abi: binaryPoolMarketAbi,
        logs: entryReceipt.logs,
        eventName: "PositionEntered",
        strict: true,
      });
      const entry = entries.find(
        (event) =>
          event.address.toLowerCase() === market.address &&
          (event.args as { user: string }).user.toLowerCase() === wallet,
      );
      if (!entry) throw new FundingError("entry_not_found", 400);
      const received = parseEventLogs({
        abi: erc20Abi,
        logs: swapReceipt.logs,
        eventName: "Transfer",
        strict: true,
      })
        .filter((event) => event.address.toLowerCase() === q.usdgAddress)
        .reduce(
          (sum, event) =>
            sum +
            (event.args.to.toLowerCase() === wallet ? event.args.value : 0n) -
            (event.args.from.toLowerCase() === wallet ? event.args.value : 0n),
          0n,
        );
      if (
        received < BigInt(q.minAmountOut) ||
        (entry.args as { amount: bigint }).amount !== received
      )
        throw new FundingError("funding_amount_mismatch", 400);
      return deps.db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`${chainId}:swap:${swapHash}`}))`,
        );
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${chainId}:${enterHash}`}))`);
        const usedSwap = await tx.query.tradeAttributions.findFirst({
          where: and(
            eq(tradeAttributions.chainId, chainId),
            eq(tradeAttributions.swapTxHash, swapHash),
          ),
        });
        if (usedSwap && usedSwap.enterTxHash !== enterHash)
          throw new FundingError("swap_already_attributed", 409);
        const previous = await tx.query.tradeAttributions.findFirst({
          where: and(
            eq(tradeAttributions.chainId, chainId),
            eq(tradeAttributions.enterTxHash, enterHash),
          ),
        });
        if (previous && (previous.quoteId !== input.quoteId || previous.swapTxHash !== swapHash))
          throw new FundingError("attribution_conflict", 409);
        await tx
          .insert(tradeAttributions)
          .values({
            chainId,
            enterTxHash: enterHash,
            swapTxHash: swapHash,
            wallet,
            fundingTokenAddress: q.tokenIn,
            fundingAmount: q.amountIn,
            quoteId: q.quoteId,
          })
          .onConflictDoNothing();
        if (previous?.status === "REJECTED")
          await tx
            .update(tradeAttributions)
            .set({ status: "PENDING", rejectionReason: null })
            .where(eq(tradeAttributions.id, previous.id));
        const updated = await tx
          .update(trades)
          .set({
            fundingTokenChainId: chainId,
            fundingTokenAddress: q.tokenIn,
            fundingAmount: q.amountIn,
            attribution: "SESSION_CORRELATED",
          })
          .where(
            and(
              eq(trades.chainId, chainId),
              eq(trades.txHash, enterHash),
              eq(trades.wallet, wallet),
            ),
          )
          .returning({ id: trades.id });
        if (updated.length)
          await tx
            .update(tradeAttributions)
            .set({ status: "CONFIRMED", confirmedAt: new Date() })
            .where(
              and(
                eq(tradeAttributions.chainId, chainId),
                eq(tradeAttributions.enterTxHash, enterHash),
              ),
            );
        return {
          status: updated.length ? "CONFIRMED" : "PENDING",
          attribution: "SESSION_CORRELATED",
        };
      });
    },
  );
};

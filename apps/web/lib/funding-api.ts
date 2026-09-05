import {
  assetBalanceSchema,
  quoteResponseSchema,
  type AttributionRequest,
  type QuoteRequest,
} from "@pl/types";
import { z } from "zod";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const messages: Record<string, string> = {
  quote_expired: "Quote expired. Request a fresh quote.",
  no_route: "No liquid route to USDG is available for this amount.",
  high_price_impact: "Price impact exceeds the supported limit. Try a smaller amount.",
  dust: "This amount is below the supported USDG minimum.",
  unsupported_token: "This token is not supported for funding.",
  adapter_unavailable:
    "Token swaps are unavailable on this network. You can still enter with USDG.",
  database_unavailable: "The indexing service is unavailable. Please retry later.",
  rate_limited: "Too many requests. Wait a minute before retrying.",
  invalid_receipts:
    "The swap and entry could not be verified together. Your confirmed position is unchanged.",
  market_mismatch:
    "Market indexing has not matched this entry yet. Retry saving attribution shortly.",
};
export async function fundingRequest(path: string, body?: unknown) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...(body
      ? {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
    signal: AbortSignal.timeout(45_000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      messages[data.error] ?? data.error ?? `API request failed (${response.status})`,
    );
  return data as unknown;
}

export const assetPageSchema = z.object({
  chainId: z.number(),
  assets: z.array(assetBalanceSchema),
  discovery: z.string(),
  nextOffset: z.number().nullable(),
});
export async function getWalletAssets(address: string, offset = 0) {
  return assetPageSchema.parse(
    await fundingRequest(`/v1/wallets/${address}/assets?offset=${offset}`),
  );
}
export async function getFundingQuote(input: QuoteRequest) {
  return quoteResponseSchema.parse(await fundingRequest("/v1/quotes", input));
}
export async function postAttribution(input: AttributionRequest) {
  return fundingRequest("/v1/trades/attribution", input);
}

const walletTradesSchema = z.object({
  chainId: z.number(),
  trades: z.array(
    z.object({
      txHash: z.string(),
      marketAddress: z.string(),
      fundingTokenAddress: z.string().nullable(),
      amountUsdg: z.string(),
      attribution: z.enum(["UNKNOWN", "ONCHAIN", "SESSION_CORRELATED"]),
    }),
  ),
});
export async function getWalletTrades(address: string) {
  return walletTradesSchema.parse(await fundingRequest(`/v1/wallets/${address}/trades`));
}

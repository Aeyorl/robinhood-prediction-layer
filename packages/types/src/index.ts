import { z } from "zod";
export { attributionMessage } from "./attribution.js";

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export const chainIdSchema = z.union([z.literal(4663), z.literal(46630)]);
export type ChainId = z.infer<typeof chainIdSchema>;

export const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "must be a 0x-prefixed 40-hex-char EVM address");
export type Address = z.infer<typeof addressSchema>;

export const txHashSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "must be a 0x-prefixed 32-byte transaction hash");
export type TxHash = z.infer<typeof txHashSchema>;

/** Unsigned uint256 as a decimal string (no exponent, no sign). */
export const uint256DecimalSchema = z
  .string()
  .max(78)
  .regex(/^\d+$/, "must be a decimal string")
  .refine((s) => /^\d+$/.test(s) && BigInt(s) < 2n ** 256n, "exceeds uint256");
export type Uint256Decimal = z.infer<typeof uint256DecimalSchema>;

/**
 * Token identity is always (chainId, contractAddress) — never just a symbol.
 * Symbols like PONS/AI are display-only and must never be trusted for identity.
 */
export const tokenIdSchema = z.object({
  chainId: chainIdSchema,
  address: addressSchema,
});
export type TokenId = z.infer<typeof tokenIdSchema>;

// ---------------------------------------------------------------------------
// Markets
// ---------------------------------------------------------------------------

export const marketStatusSchema = z.enum(["OPEN", "LOCKED", "RESOLVED", "CANCELLED"]);
export type MarketStatus = z.infer<typeof marketStatusSchema>;

export const marketSideSchema = z.enum(["YES", "NO"]);
export type MarketSide = z.infer<typeof marketSideSchema>;

export const comparatorSchema = z.enum(["PRICE_ABOVE_AT_TIME", "PRICE_BELOW_AT_TIME"]);
export type Comparator = z.infer<typeof comparatorSchema>;

export const marketTemplateSchema = z.enum(["PRICE_ABOVE_AT_TIME", "PRICE_BELOW_AT_TIME"]);
export type MarketTemplate = z.infer<typeof marketTemplateSchema>;

export interface MarketTerms {
  collateral: TokenId;
  resolver: Address;
  oracleAssetKey: string; // keccak256(abi.encode(chainId, tokenAddress)) hex
  comparator: Comparator;
  strike: string; // decimal string, strikeDecimals fixed-point
  strikeDecimals: number;
  openTime: number; // unix seconds
  lockTime: number;
  resolutionTime: number;
  gracePeriodSeconds: number;
  feeBps: number;
  minEntry: string; // collateral units (wei)
  maxEntry: string | null; // per-user-per-side cap in collateral units
  question: string;
  metadataUri: string;
}

export const oracleHealthSchema = z.object({
  healthy: z.boolean(),
  price: z.string(),
  decimals: z.number(),
  updatedAt: z.bigint(),
  isStale: z.boolean(),
  sequencerUp: z.boolean(),
  sequencerGraceElapsed: z.boolean(),
  paused: z.boolean(),
});
export type OracleHealth = z.infer<typeof oracleHealthSchema>;

// ---------------------------------------------------------------------------
// Wallet assets
// ---------------------------------------------------------------------------

export const assetSupportStatusSchema = z.enum([
  "UNKNOWN",
  "DISCOVERED",
  "QUOTE_PENDING",
  "SUPPORTED",
  "NO_ROUTE",
  "HIGH_IMPACT",
  "UNSAFE_BEHAVIOR",
  "BLOCKED",
  "DUST",
]);
export type AssetSupportStatus = z.infer<typeof assetSupportStatusSchema>;

export const assetBalanceSchema = z.object({
  token: tokenIdSchema,
  symbol: z.string(),
  name: z.string(),
  decimals: z.number(),
  balance: z.string(), // raw units (wei), decimal string
  usdgEstimate: z.string().nullable(), // normalized collateral estimate
  supportStatus: assetSupportStatusSchema,
  updatedAt: z.number(),
});
export type AssetBalance = z.infer<typeof assetBalanceSchema>;

// ---------------------------------------------------------------------------
// Trades / attribution
// ---------------------------------------------------------------------------

export const attributionSchema = z.enum(["SESSION_CORRELATED", "ONCHAIN", "UNKNOWN"]);
export type Attribution = z.infer<typeof attributionSchema>;

export const tradeSchema = z.object({
  chainId: chainIdSchema,
  txHash: addressSchema,
  logIndex: z.number().int().nonnegative(),
  market: addressSchema,
  wallet: addressSchema,
  side: marketSideSchema,
  amountUsdg: z.string(),
  fundingToken: tokenIdSchema.nullable(),
  fundingAmount: z.string().nullable(),
  attribution: attributionSchema,
  timestamp: z.number(),
});
export type Trade = z.infer<typeof tradeSchema>;

// ---------------------------------------------------------------------------
// Claims / refunds
// ---------------------------------------------------------------------------

export const claimSchema = z.object({
  chainId: chainIdSchema,
  txHash: addressSchema,
  logIndex: z.number().int().nonnegative(),
  market: addressSchema,
  wallet: addressSchema,
  gross: z.string(),
  fee: z.string(),
  net: z.string(),
  timestamp: z.number(),
});
export type Claim = z.infer<typeof claimSchema>;

export const refundSchema = z.object({
  chainId: chainIdSchema,
  txHash: addressSchema,
  logIndex: z.number().int().nonnegative(),
  market: addressSchema,
  wallet: addressSchema,
  principal: z.string(),
  timestamp: z.number(),
});
export type Refund = z.infer<typeof refundSchema>;

// ---------------------------------------------------------------------------
// Positions (portfolio)
// ---------------------------------------------------------------------------

export interface Position {
  market: Address;
  side: MarketSide;
  stake: string; // normalized USDG (wei)
  fundingToken: TokenId | null;
  marketStatus: MarketStatus;
  yesPool: string;
  noPool: string;
  claimable: boolean; // resolved & won & not yet claimed
  refundable: boolean; // cancelled & not yet refunded
  claimed: boolean;
  refunded: boolean;
}

// ---------------------------------------------------------------------------
// Funding-layer quotes (Phase 4)
// ---------------------------------------------------------------------------

/**
 * Quote request. The chain ID is NEVER accepted from the client — the API
 * derives it from its own environment — and the output token is always forced
 * to the canonical USDG address.
 */
export const quoteRequestSchema = z.object({
  tokenIn: addressSchema,
  amountIn: uint256DecimalSchema,
  wallet: addressSchema,
  /** Market the user intends to enter — used for analytics/UX only. */
  market: addressSchema.optional(),
});
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

/** The swap transaction the wallet should sign for this quote. */
export const swapPlanSchema = z.object({
  to: addressSchema,
  data: z
    .string()
    .max(262144)
    .regex(/^0x(?:[0-9a-fA-F]{2}){4,}$/, "must contain a function selector and whole hex bytes"),
  value: uint256DecimalSchema.default("0"),
});
export type SwapPlan = z.infer<typeof swapPlanSchema>;

export const quoteResponseSchema = z.object({
  quoteId: z.string(),
  chainId: chainIdSchema,
  adapter: z.enum(["mock", "uniswap"]),
  tokenIn: addressSchema,
  /** Always the canonical USDG address for the chain — never client-chosen. */
  usdg: addressSchema,
  amountIn: uint256DecimalSchema,
  amountOut: uint256DecimalSchema,
  minAmountOut: uint256DecimalSchema,
  slippageBps: z.number().int().nonnegative(),
  priceImpactBps: z.string().nullable(),
  /** Unix milliseconds after which the quote must be re-requested. */
  expiresAt: z.number(),
  routeSummary: z.string().nullable(),
  swapPlan: swapPlanSchema,
  approvalSpender: addressSchema,
});
export type QuoteResponse = z.infer<typeof quoteResponseSchema>;

export const quoteErrorCodeSchema = z.enum([
  "quote_expired",
  "no_route",
  "high_price_impact",
  "unsupported_token",
  "invalid_amount",
  "adapter_unavailable",
]);
export type QuoteErrorCode = z.infer<typeof quoteErrorCodeSchema>;

// ---------------------------------------------------------------------------
// Session attribution (Phase 4)
// ---------------------------------------------------------------------------

/**
 * Browser-session correlation between a funding-token swap and the
 * immediately following market entry. Never presented as trustless onchain
 * attribution — the API verifies the wallet signature and both receipts;
 * the worker binds the correlation to the canonical indexed entry.
 */
export const attributionRequestSchema = z.object({
  enterTxHash: txHashSchema,
  swapTxHash: txHashSchema,
  wallet: addressSchema,
  fundingToken: addressSchema,
  fundingAmount: uint256DecimalSchema,
  quoteId: z.string().uuid(),
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
});
export type AttributionRequest = z.infer<typeof attributionRequestSchema>;

import { z } from "zod";

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export const chainIdSchema = z.union([z.literal(4663), z.literal(46630)]);
export type ChainId = z.infer<typeof chainIdSchema>;

export const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "must be a 0x-prefixed 40-hex-char EVM address");
export type Address = z.infer<typeof addressSchema>;

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

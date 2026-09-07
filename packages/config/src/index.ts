import { z } from "zod";

/**
 * Branding — rename the product in exactly one place.
 *
 * The owner-approved product name is "Wagerly". Nothing else in the
 * codebase should hardcode the product name; import from here.
 */
export const branding = {
  /** Owner-approved product name. */
  appName: "Wagerly",
  /** Robinhood Chain must always be spelled in full in external copy. */
  chainName: "Robinhood Chain",
} as const;

/** Chain IDs this product supports: 4663 mainnet, 46630 testnet. */
export const chainIdSchema = z.union([z.literal(4663), z.literal(46630)]);
export type ChainId = z.infer<typeof chainIdSchema>;

/**
 * Chain ID coming from process.env is a string ("46630"); coerce before the
 * literal union so a plain .env works for every app.
 */
export const envChainIdSchema = z.coerce.number().pipe(chainIdSchema);

// ---------------------------------------------------------------------------
// apps/web
// ---------------------------------------------------------------------------

export const webEnvSchema = z.object({
  NEXT_PUBLIC_CHAIN_ID: envChainIdSchema.default(46630),
  NEXT_PUBLIC_API_URL: z.url().default("http://localhost:3001"),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_RPC_MAINNET: z.url().optional(),
  NEXT_PUBLIC_RPC_TESTNET: z.url().optional(),
});
export type WebEnv = z.infer<typeof webEnvSchema>;

export function loadWebEnv(env: NodeJS.ProcessEnv = process.env): WebEnv {
  return webEnvSchema.parse(env);
}

// ---------------------------------------------------------------------------
// apps/api
// ---------------------------------------------------------------------------

export const apiEnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  PRODUCTION_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  MAINNET_EXTERNAL_AUDIT_APPROVED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  MAINNET_COMPLIANCE_APPROVED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().max(10_000).default(300),
  CHAIN_ID: envChainIdSchema.default(46630),
  /** Funding-layer swap adapter: deterministic mocks locally, Uniswap on mainnet. */
  SWAP_ADAPTER: z.enum(["mock", "uniswap"]).default("mock"),
  RPC_HTTP_URL: z.url().default("http://127.0.0.1:8545"),
  RPC_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(10_000),
  MOCK_SWAP_ADAPTER_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  /** Optional atomic swap-and-enter router (Phase 7). */
  PREDICTION_ENTRY_ROUTER_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  /** Optional override for the deterministic Uniswap proxy approval contract. */
  UNISWAP_PROXY_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  KNOWN_TOKEN_ADDRESSES: z
    .string()
    .default("")
    .transform((s) =>
      s
        .split(",")
        .map((a) => a.trim().toLowerCase())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)).max(100)),
  BLOCKED_TOKEN_ADDRESSES: z
    .string()
    .default("")
    .transform((s) =>
      s
        .split(",")
        .map((a) => a.trim().toLowerCase())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/))),
  /** Uniswap Trading API credentials — server-side only, never sent to the client. */
  UNISWAP_API_KEY: z.string().min(1).optional(),
  UNISWAP_API_URL: z.url().default("https://trade-api.gateway.uniswap.org/v1"),
  /** Hard caps on the quote service; the client can never loosen these. */
  MAX_SLIPPAGE_BPS: z.coerce.number().int().positive().max(1000).default(100),
  MAX_PRICE_IMPACT_BPS: z.coerce.number().int().positive().max(5000).default(300),
  QUOTE_TTL_SECONDS: z.coerce.number().int().positive().max(600).default(60),
  /** Canonical USDG override; defaults to the chain-config address per chain. */
  USDG_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "invalid USDG_ADDRESS")
    .optional(),
  /** Dust threshold in USDG base units; defaults to 0.01 using onchain decimals. */
  DUST_THRESHOLD_USDG: z
    .string()
    .regex(/^\d+$/, "DUST_THRESHOLD_USDG must be a decimal string")
    .optional(),
  /** Cap on how many tokens one assets request may lazily quote. */
  MAX_QUOTED_ASSETS_PER_REQUEST: z.coerce.number().int().positive().max(25).default(10),
});
export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function loadApiEnv(env: NodeJS.ProcessEnv = process.env): ApiEnv {
  const parsed = apiEnvSchema.parse(env);
  if (parsed.PRODUCTION_MODE && parsed.CHAIN_ID === 4663) {
    const errors: string[] = [];
    if (!parsed.RPC_HTTP_URL.startsWith("https://")) errors.push("RPC_HTTP_URL must use HTTPS");
    if (parsed.CORS_ORIGIN.includes("localhost") || parsed.CORS_ORIGIN.includes("127.0.0.1"))
      errors.push("CORS_ORIGIN must be a production origin");
    if (parsed.SWAP_ADAPTER !== "uniswap" || !parsed.UNISWAP_API_KEY)
      errors.push("Uniswap routing must be configured");
    if (!parsed.PREDICTION_ENTRY_ROUTER_ADDRESS)
      errors.push("PREDICTION_ENTRY_ROUTER_ADDRESS is required");
    if (!parsed.MAINNET_EXTERNAL_AUDIT_APPROVED)
      errors.push("MAINNET_EXTERNAL_AUDIT_APPROVED is required");
    if (!parsed.MAINNET_COMPLIANCE_APPROVED) errors.push("MAINNET_COMPLIANCE_APPROVED is required");
    if (errors.length) throw new Error(`mainnet production gate failed: ${errors.join("; ")}`);
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// apps/worker
// ---------------------------------------------------------------------------

export const workerEnvSchema = z.object({
  CHAIN_ID: envChainIdSchema.default(46630),
  RPC_WS_URL: z.url(),
  RPC_HTTP_URL: z.url(),
  START_BLOCK: z.coerce.number().int().nonnegative().default(0),
  /** MarketFactory the worker indexes events from — must be configured per chain. */
  FACTORY_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "invalid FACTORY_ADDRESS"),
  PREDICTION_ENTRY_ROUTER_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  HTTP_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(4000),
  /** Chainlink Data Streams credentials are server-side only. */
  DATA_STREAMS_API_KEY: z.string().uuid().optional(),
  DATA_STREAMS_USER_SECRET: z.string().min(1).optional(),
  DATA_STREAMS_ENDPOINT: z.url().default("https://api.dataengine.chain.link"),
});
export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function loadWorkerEnv(env: NodeJS.ProcessEnv = process.env): WorkerEnv {
  return workerEnvSchema.parse(env);
}

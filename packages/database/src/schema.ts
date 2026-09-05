import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const marketStatusEnum = pgEnum("market_status", [
  "OPEN",
  "LOCKED",
  "RESOLVED",
  "CANCELLED",
]);
export const marketSideEnum = pgEnum("market_side", ["YES", "NO"]);
export const comparatorEnum = pgEnum("comparator", ["PRICE_ABOVE_AT_TIME", "PRICE_BELOW_AT_TIME"]);
export const templateEnum = pgEnum("market_template", [
  "PRICE_ABOVE_AT_TIME",
  "PRICE_BELOW_AT_TIME",
]);
export const supportStatusEnum = pgEnum("asset_support_status", [
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
export const attributionEnum = pgEnum("attribution", ["SESSION_CORRELATED", "ONCHAIN", "UNKNOWN"]);

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

/** ERC-20 assets known to the system. Identity is always (chainId, address). */
export const assets = pgTable(
  "assets",
  {
    chainId: integer("chain_id").notNull(),
    address: text("address").notNull(),
    symbol: text("symbol").notNull(),
    name: text("name").notNull(),
    decimals: integer("decimals").notNull(),
    logoUrl: text("logo_url"),
    supportStatus: supportStatusEnum("support_status").notNull().default("UNKNOWN"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.chainId, t.address] })],
);

/** Chainlink oracle configuration per asset (feed, heartbeat, pause state). */
export const oracleAssets = pgTable(
  "oracle_assets",
  {
    chainId: integer("chain_id").notNull(),
    address: text("address").notNull(),
    feedAddress: text("feed_address").notNull(),
    sequencerFeedAddress: text("sequencer_feed_address"),
    heartbeatSeconds: integer("heartbeat_seconds").notNull(),
    feedDecimals: integer("feed_decimals").notNull(),
    paused: boolean("paused").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.chainId, t.address] })],
);

// ---------------------------------------------------------------------------
// Markets
// ---------------------------------------------------------------------------

export const markets = pgTable(
  "markets",
  {
    chainId: integer("chain_id").notNull(),
    address: text("address").notNull(),
    slug: text("slug").notNull(),
    question: text("question").notNull(),
    template: templateEnum("template").notNull(),
    comparator: comparatorEnum("comparator").notNull(),
    strike: text("strike").notNull(), // fixed-point decimal string
    strikeDecimals: integer("strike_decimals").notNull(),
    collateralChainId: integer("collateral_chain_id").notNull(),
    collateralAddress: text("collateral_address").notNull(),
    oracleAssetChainId: integer("oracle_asset_chain_id").notNull(),
    oracleAssetAddress: text("oracle_asset_address").notNull(),
    resolver: text("resolver").notNull(),
    feeBps: integer("fee_bps").notNull(),
    openTime: timestamp("open_time", { withTimezone: true }).notNull(),
    lockTime: timestamp("lock_time", { withTimezone: true }).notNull(),
    resolutionTime: timestamp("resolution_time", { withTimezone: true }).notNull(),
    gracePeriodSeconds: integer("grace_period_seconds").notNull(),
    minEntry: text("min_entry").notNull(),
    maxEntry: text("max_entry"),
    status: marketStatusEnum("status").notNull().default("OPEN"),
    winningOutcome: marketSideEnum("winning_outcome"),
    resolvedPrice: text("resolved_price"),
    yesPool: text("yes_pool").notNull().default("0"),
    noPool: text("no_pool").notNull().default("0"),
    volumeUsdg: numeric("volume_usdg", { precision: 78, scale: 0 }),
    metadataUri: text("metadata_uri").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.chainId, t.address] }),
    uniqueIndex("markets_slug_unique").on(t.slug),
    index("markets_status_idx").on(t.status),
  ],
);

/** Pool-share snapshots for charting capital split over time. */
export const marketSnapshots = pgTable(
  "market_snapshots",
  {
    id: serial("id").primaryKey(),
    marketChainId: integer("market_chain_id").notNull(),
    marketAddress: text("market_address").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
    yesPool: text("yes_pool").notNull(),
    noPool: text("no_pool").notNull(),
    volumeUsdg: numeric("volume_usdg", { precision: 78, scale: 0 }),
  },
  (t) => [index("snapshots_market_idx").on(t.marketChainId, t.marketAddress)],
);

// ---------------------------------------------------------------------------
// Chain events (indexer)
// ---------------------------------------------------------------------------

/** Raw indexed events. Identity is (chainId, txHash, logIndex). */
export const chainEvents = pgTable(
  "chain_events",
  {
    id: serial("id").primaryKey(),
    chainId: integer("chain_id").notNull(),
    txHash: text("tx_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    blockNumber: bigint("block_number", { mode: "number" }).notNull(),
    blockHash: text("block_hash").notNull(),
    eventType: text("event_type").notNull(),
    marketAddress: text("market_address"),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("chain_events_identity_unique").on(t.chainId, t.txHash, t.logIndex),
    index("chain_events_block_idx").on(t.chainId, t.blockNumber),
  ],
);

// ---------------------------------------------------------------------------
// Trades / claims / refunds
// ---------------------------------------------------------------------------

export const trades = pgTable(
  "trades",
  {
    id: serial("id").primaryKey(),
    chainId: integer("chain_id").notNull(),
    txHash: text("tx_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    marketChainId: integer("market_chain_id").notNull(),
    marketAddress: text("market_address").notNull(),
    wallet: text("wallet").notNull(),
    side: marketSideEnum("side").notNull(),
    amountUsdg: text("amount_usdg").notNull(),
    fundingTokenChainId: integer("funding_token_chain_id"),
    fundingTokenAddress: text("funding_token_address"),
    fundingAmount: text("funding_amount"),
    attribution: attributionEnum("attribution").notNull().default("UNKNOWN"),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("trades_identity_unique").on(t.chainId, t.txHash, t.logIndex),
    index("trades_wallet_idx").on(t.chainId, t.wallet),
    index("trades_market_idx").on(t.marketChainId, t.marketAddress),
  ],
);

export const claims = pgTable(
  "claims",
  {
    id: serial("id").primaryKey(),
    chainId: integer("chain_id").notNull(),
    txHash: text("tx_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    marketChainId: integer("market_chain_id").notNull(),
    marketAddress: text("market_address").notNull(),
    wallet: text("wallet").notNull(),
    gross: text("gross").notNull(),
    fee: text("fee").notNull(),
    net: text("net").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("claims_identity_unique").on(t.chainId, t.txHash, t.logIndex),
    index("claims_wallet_idx").on(t.chainId, t.wallet),
  ],
);

export const refunds = pgTable(
  "refunds",
  {
    id: serial("id").primaryKey(),
    chainId: integer("chain_id").notNull(),
    txHash: text("tx_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    marketChainId: integer("market_chain_id").notNull(),
    marketAddress: text("market_address").notNull(),
    wallet: text("wallet").notNull(),
    principal: text("principal").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("refunds_identity_unique").on(t.chainId, t.txHash, t.logIndex),
    index("refunds_wallet_idx").on(t.chainId, t.wallet),
  ],
);

// ---------------------------------------------------------------------------
// Wallet profiles / stats
// ---------------------------------------------------------------------------

export const walletProfiles = pgTable(
  "wallet_profiles",
  {
    chainId: integer("chain_id").notNull(),
    address: text("address").notNull(),
    nickname: text("nickname"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.chainId, t.address] })],
);

export const walletStats = pgTable(
  "wallet_stats",
  {
    chainId: integer("chain_id").notNull(),
    address: text("address").notNull(),
    totalStakedUsdg: numeric("total_staked_usdg", { precision: 78, scale: 0 })
      .notNull()
      .default("0"),
    totalClaimedUsdg: numeric("total_claimed_usdg", { precision: 78, scale: 0 })
      .notNull()
      .default("0"),
    realizedPnlUsdg: numeric("realized_pnl_usdg", { precision: 78, scale: 0 })
      .notNull()
      .default("0"),
    winCount: integer("win_count").notNull().default(0),
    lossCount: integer("loss_count").notNull().default(0),
    openPositionCount: integer("open_position_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.chainId, t.address] })],
);

// ---------------------------------------------------------------------------
// Community analytics (by original source funding token)
// ---------------------------------------------------------------------------

export const communityStats = pgTable(
  "community_stats",
  {
    chainId: integer("chain_id").notNull(),
    tokenAddress: text("token_address").notNull(),
    volumeUsdg: numeric("volume_usdg", { precision: 78, scale: 0 }).notNull().default("0"),
    participatingWallets: integer("participating_wallets").notNull().default(0),
    hitRate: numeric("hit_rate", { precision: 10, scale: 6 }),
    realizedPnlUsdg: numeric("realized_pnl_usdg", { precision: 78, scale: 0 })
      .notNull()
      .default("0"),
    marketsParticipated: integer("markets_participated").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.chainId, t.tokenAddress] })],
);

export const marketCommunitySplits = pgTable(
  "market_community_splits",
  {
    id: serial("id").primaryKey(),
    marketChainId: integer("market_chain_id").notNull(),
    marketAddress: text("market_address").notNull(),
    chainId: integer("chain_id").notNull(),
    tokenAddress: text("token_address").notNull(),
    yesVolumeUsdg: numeric("yes_volume_usdg", { precision: 78, scale: 0 }).notNull().default("0"),
    noVolumeUsdg: numeric("no_volume_usdg", { precision: 78, scale: 0 }).notNull().default("0"),
    walletsYes: integer("wallets_yes").notNull().default(0),
    walletsNo: integer("wallets_no").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("mcs_unique").on(t.marketChainId, t.marketAddress, t.chainId, t.tokenAddress),
    index("mcs_token_idx").on(t.chainId, t.tokenAddress),
  ],
);

// ---------------------------------------------------------------------------
// Funding-token discovery (indexer wallet scan, Phase 4)
// ---------------------------------------------------------------------------

/**
 * Every ERC-20 token observed by the indexer's Transfer scan. Identity is
 * (chainId, address) — symbol/name/decimals are display metadata only and may
 * be null when safe reads fail (weird return values, transfer restrictions).
 */
export const tokens = pgTable(
  "tokens",
  {
    chainId: integer("chain_id").notNull(),
    address: text("address").notNull(),
    symbol: text("symbol"),
    name: text("name"),
    decimals: integer("decimals"),
    metadataStatus: text("metadata_status").notNull().default("PENDING"), // PENDING | OK | UNREADABLE
    supportStatus: supportStatusEnum("support_status").notNull().default("DISCOVERED"),
    firstSeenBlock: bigint("first_seen_block", { mode: "number" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.chainId, t.address] }),
    index("tokens_support_status_idx").on(t.chainId, t.supportStatus),
  ],
);

/**
 * Append-only ERC-20 Transfer log used for wallet asset discovery. Balances
 * are aggregated on read (SUM(in) - SUM(out)) so reorg rollback of this table
 * automatically rewinds balances too.
 */
export const tokenTransfers = pgTable(
  "token_transfers",
  {
    id: serial("id").primaryKey(),
    chainId: integer("chain_id").notNull(),
    txHash: text("tx_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    blockNumber: bigint("block_number", { mode: "number" }).notNull(),
    blockHash: text("block_hash").notNull(),
    tokenAddress: text("token_address").notNull(),
    fromAddress: text("from_address").notNull(),
    toAddress: text("to_address").notNull(),
    value: text("value").notNull(), // uint256 as decimal string
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("token_transfers_identity_unique").on(t.chainId, t.txHash, t.logIndex),
    index("token_transfers_to_idx").on(t.chainId, t.toAddress),
    index("token_transfers_from_idx").on(t.chainId, t.fromAddress),
    index("token_transfers_token_idx").on(t.chainId, t.tokenAddress),
  ],
);

// ---------------------------------------------------------------------------
// Funding-layer quotes and attribution (Phase 4)
// ---------------------------------------------------------------------------

/**
 * Quote metadata, persisted for analytics only — blockchain state stays
 * authoritative. `quoteId` binds the response the client saw to what was
 * requested; it never grants onchain rights.
 */
export const quotes = pgTable(
  "quotes",
  {
    id: serial("id").primaryKey(),
    quoteId: text("quote_id").notNull().unique(),
    chainId: integer("chain_id").notNull(),
    adapter: text("adapter").notNull(), // mock | uniswap
    wallet: text("wallet"),
    tokenIn: text("token_in").notNull(),
    usdgAddress: text("usdg_address").notNull(),
    amountIn: text("amount_in").notNull(),
    amountOut: text("amount_out").notNull(),
    minAmountOut: text("min_amount_out").notNull(),
    slippageBps: integer("slippage_bps").notNull(),
    priceImpactBps: numeric("price_impact_bps", { precision: 20, scale: 4 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    routeSummary: jsonb("route_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("quotes_wallet_idx").on(t.chainId, t.wallet)],
);

/**
 * Browser-session correlation between a swap tx and the immediately following
 * market entry. The worker consults this when projecting PositionEntered and
 * upgrades the trades row from UNKNOWN to SESSION_CORRELATED (never presented
 * as trustless onchain attribution).
 */
export const tradeAttributions = pgTable(
  "trade_attributions",
  {
    id: serial("id").primaryKey(),
    chainId: integer("chain_id").notNull(),
    enterTxHash: text("enter_tx_hash").notNull(),
    swapTxHash: text("swap_tx_hash").notNull(),
    wallet: text("wallet").notNull(),
    fundingTokenAddress: text("funding_token_address").notNull(),
    fundingAmount: text("funding_amount"),
    quoteId: text("quote_id"),
    status: text("status").notNull().default("PENDING"), // PENDING | CONFIRMED | REJECTED
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("trade_attributions_enter_tx_unique").on(t.chainId, t.enterTxHash),
    index("trade_attributions_status_idx").on(t.chainId, t.status),
  ],
);

// ---------------------------------------------------------------------------
// Admin audit
// ---------------------------------------------------------------------------

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: serial("id").primaryKey(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    target: text("target"),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_actor_idx").on(t.actor)],
);

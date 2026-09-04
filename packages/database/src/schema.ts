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

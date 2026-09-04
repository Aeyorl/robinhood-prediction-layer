CREATE TYPE "public"."attribution" AS ENUM('SESSION_CORRELATED', 'ONCHAIN', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."comparator" AS ENUM('PRICE_ABOVE_AT_TIME', 'PRICE_BELOW_AT_TIME');--> statement-breakpoint
CREATE TYPE "public"."market_side" AS ENUM('YES', 'NO');--> statement-breakpoint
CREATE TYPE "public"."market_status" AS ENUM('OPEN', 'LOCKED', 'RESOLVED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."asset_support_status" AS ENUM('UNKNOWN', 'DISCOVERED', 'QUOTE_PENDING', 'SUPPORTED', 'NO_ROUTE', 'HIGH_IMPACT', 'UNSAFE_BEHAVIOR', 'BLOCKED', 'DUST');--> statement-breakpoint
CREATE TYPE "public"."market_template" AS ENUM('PRICE_ABOVE_AT_TIME', 'PRICE_BELOW_AT_TIME');--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"chain_id" integer NOT NULL,
	"address" text NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"decimals" integer NOT NULL,
	"logo_url" text,
	"support_status" "asset_support_status" DEFAULT 'UNKNOWN' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_chain_id_address_pk" PRIMARY KEY("chain_id","address")
);
--> statement-breakpoint
CREATE TABLE "chain_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"tx_hash" text NOT NULL,
	"log_index" integer NOT NULL,
	"block_number" bigint NOT NULL,
	"block_hash" text NOT NULL,
	"event_type" text NOT NULL,
	"market_address" text,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"tx_hash" text NOT NULL,
	"log_index" integer NOT NULL,
	"market_chain_id" integer NOT NULL,
	"market_address" text NOT NULL,
	"wallet" text NOT NULL,
	"gross" text NOT NULL,
	"fee" text NOT NULL,
	"net" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_stats" (
	"chain_id" integer NOT NULL,
	"token_address" text NOT NULL,
	"volume_usdg" numeric(78, 0) DEFAULT '0' NOT NULL,
	"participating_wallets" integer DEFAULT 0 NOT NULL,
	"hit_rate" numeric(10, 6),
	"realized_pnl_usdg" numeric(78, 0) DEFAULT '0' NOT NULL,
	"markets_participated" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_stats_chain_id_token_address_pk" PRIMARY KEY("chain_id","token_address")
);
--> statement-breakpoint
CREATE TABLE "market_community_splits" (
	"id" serial PRIMARY KEY NOT NULL,
	"market_chain_id" integer NOT NULL,
	"market_address" text NOT NULL,
	"chain_id" integer NOT NULL,
	"token_address" text NOT NULL,
	"yes_volume_usdg" numeric(78, 0) DEFAULT '0' NOT NULL,
	"no_volume_usdg" numeric(78, 0) DEFAULT '0' NOT NULL,
	"wallets_yes" integer DEFAULT 0 NOT NULL,
	"wallets_no" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"market_chain_id" integer NOT NULL,
	"market_address" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"yes_pool" text NOT NULL,
	"no_pool" text NOT NULL,
	"volume_usdg" numeric(78, 0)
);
--> statement-breakpoint
CREATE TABLE "markets" (
	"chain_id" integer NOT NULL,
	"address" text NOT NULL,
	"slug" text NOT NULL,
	"question" text NOT NULL,
	"template" "market_template" NOT NULL,
	"comparator" "comparator" NOT NULL,
	"strike" text NOT NULL,
	"strike_decimals" integer NOT NULL,
	"collateral_chain_id" integer NOT NULL,
	"collateral_address" text NOT NULL,
	"oracle_asset_chain_id" integer NOT NULL,
	"oracle_asset_address" text NOT NULL,
	"resolver" text NOT NULL,
	"fee_bps" integer NOT NULL,
	"open_time" timestamp with time zone NOT NULL,
	"lock_time" timestamp with time zone NOT NULL,
	"resolution_time" timestamp with time zone NOT NULL,
	"grace_period_seconds" integer NOT NULL,
	"min_entry" text NOT NULL,
	"max_entry" text,
	"status" "market_status" DEFAULT 'OPEN' NOT NULL,
	"winning_outcome" "market_side",
	"resolved_price" text,
	"yes_pool" text DEFAULT '0' NOT NULL,
	"no_pool" text DEFAULT '0' NOT NULL,
	"volume_usdg" numeric(78, 0),
	"metadata_uri" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "markets_chain_id_address_pk" PRIMARY KEY("chain_id","address")
);
--> statement-breakpoint
CREATE TABLE "oracle_assets" (
	"chain_id" integer NOT NULL,
	"address" text NOT NULL,
	"feed_address" text NOT NULL,
	"sequencer_feed_address" text,
	"heartbeat_seconds" integer NOT NULL,
	"feed_decimals" integer NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oracle_assets_chain_id_address_pk" PRIMARY KEY("chain_id","address")
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"tx_hash" text NOT NULL,
	"log_index" integer NOT NULL,
	"market_chain_id" integer NOT NULL,
	"market_address" text NOT NULL,
	"wallet" text NOT NULL,
	"principal" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"tx_hash" text NOT NULL,
	"log_index" integer NOT NULL,
	"market_chain_id" integer NOT NULL,
	"market_address" text NOT NULL,
	"wallet" text NOT NULL,
	"side" "market_side" NOT NULL,
	"amount_usdg" text NOT NULL,
	"funding_token_chain_id" integer,
	"funding_token_address" text,
	"funding_amount" text,
	"attribution" "attribution" DEFAULT 'UNKNOWN' NOT NULL,
	"timestamp" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_profiles" (
	"chain_id" integer NOT NULL,
	"address" text NOT NULL,
	"nickname" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_profiles_chain_id_address_pk" PRIMARY KEY("chain_id","address")
);
--> statement-breakpoint
CREATE TABLE "wallet_stats" (
	"chain_id" integer NOT NULL,
	"address" text NOT NULL,
	"total_staked_usdg" numeric(78, 0) DEFAULT '0' NOT NULL,
	"total_claimed_usdg" numeric(78, 0) DEFAULT '0' NOT NULL,
	"realized_pnl_usdg" numeric(78, 0) DEFAULT '0' NOT NULL,
	"win_count" integer DEFAULT 0 NOT NULL,
	"loss_count" integer DEFAULT 0 NOT NULL,
	"open_position_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_stats_chain_id_address_pk" PRIMARY KEY("chain_id","address")
);
--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "admin_audit_log" USING btree ("actor");--> statement-breakpoint
CREATE UNIQUE INDEX "chain_events_identity_unique" ON "chain_events" USING btree ("chain_id","tx_hash","log_index");--> statement-breakpoint
CREATE INDEX "chain_events_block_idx" ON "chain_events" USING btree ("chain_id","block_number");--> statement-breakpoint
CREATE UNIQUE INDEX "claims_identity_unique" ON "claims" USING btree ("chain_id","tx_hash","log_index");--> statement-breakpoint
CREATE INDEX "claims_wallet_idx" ON "claims" USING btree ("chain_id","wallet");--> statement-breakpoint
CREATE UNIQUE INDEX "mcs_unique" ON "market_community_splits" USING btree ("market_chain_id","market_address","chain_id","token_address");--> statement-breakpoint
CREATE INDEX "mcs_token_idx" ON "market_community_splits" USING btree ("chain_id","token_address");--> statement-breakpoint
CREATE INDEX "snapshots_market_idx" ON "market_snapshots" USING btree ("market_chain_id","market_address");--> statement-breakpoint
CREATE UNIQUE INDEX "markets_slug_unique" ON "markets" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "markets_status_idx" ON "markets" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_identity_unique" ON "refunds" USING btree ("chain_id","tx_hash","log_index");--> statement-breakpoint
CREATE INDEX "refunds_wallet_idx" ON "refunds" USING btree ("chain_id","wallet");--> statement-breakpoint
CREATE UNIQUE INDEX "trades_identity_unique" ON "trades" USING btree ("chain_id","tx_hash","log_index");--> statement-breakpoint
CREATE INDEX "trades_wallet_idx" ON "trades" USING btree ("chain_id","wallet");--> statement-breakpoint
CREATE INDEX "trades_market_idx" ON "trades" USING btree ("market_chain_id","market_address");
CREATE TABLE "quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote_id" text NOT NULL,
	"chain_id" integer NOT NULL,
	"adapter" text NOT NULL,
	"wallet" text,
	"token_in" text NOT NULL,
	"usdg_address" text NOT NULL,
	"amount_in" text NOT NULL,
	"amount_out" text NOT NULL,
	"min_amount_out" text NOT NULL,
	"slippage_bps" integer NOT NULL,
	"price_impact_bps" numeric(20, 4),
	"expires_at" timestamp with time zone NOT NULL,
	"route_summary" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_quote_id_unique" UNIQUE("quote_id")
);
--> statement-breakpoint
CREATE TABLE "token_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"tx_hash" text NOT NULL,
	"log_index" integer NOT NULL,
	"block_number" bigint NOT NULL,
	"block_hash" text NOT NULL,
	"token_address" text NOT NULL,
	"from_address" text NOT NULL,
	"to_address" text NOT NULL,
	"value" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"chain_id" integer NOT NULL,
	"address" text NOT NULL,
	"symbol" text,
	"name" text,
	"decimals" integer,
	"metadata_status" text DEFAULT 'PENDING' NOT NULL,
	"support_status" "asset_support_status" DEFAULT 'DISCOVERED' NOT NULL,
	"first_seen_block" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tokens_chain_id_address_pk" PRIMARY KEY("chain_id","address")
);
--> statement-breakpoint
CREATE TABLE "trade_attributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"enter_tx_hash" text NOT NULL,
	"swap_tx_hash" text NOT NULL,
	"wallet" text NOT NULL,
	"funding_token_address" text NOT NULL,
	"funding_amount" text,
	"quote_id" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "quotes_wallet_idx" ON "quotes" USING btree ("chain_id","wallet");--> statement-breakpoint
CREATE UNIQUE INDEX "token_transfers_identity_unique" ON "token_transfers" USING btree ("chain_id","tx_hash","log_index");--> statement-breakpoint
CREATE INDEX "token_transfers_to_idx" ON "token_transfers" USING btree ("chain_id","to_address");--> statement-breakpoint
CREATE INDEX "token_transfers_from_idx" ON "token_transfers" USING btree ("chain_id","from_address");--> statement-breakpoint
CREATE INDEX "token_transfers_token_idx" ON "token_transfers" USING btree ("chain_id","token_address");--> statement-breakpoint
CREATE INDEX "tokens_support_status_idx" ON "tokens" USING btree ("chain_id","support_status");--> statement-breakpoint
CREATE UNIQUE INDEX "trade_attributions_enter_tx_unique" ON "trade_attributions" USING btree ("chain_id","enter_tx_hash");--> statement-breakpoint
CREATE INDEX "trade_attributions_status_idx" ON "trade_attributions" USING btree ("chain_id","status");
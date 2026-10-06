CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"name" text DEFAULT 'Player' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "daily_scores" (
	"day" text NOT NULL,
	"account_id" uuid NOT NULL,
	"ticks" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_scores_day_account_id_pk" PRIMARY KEY("day","account_id")
);
--> statement-breakpoint
CREATE TABLE "match_players" (
	"match_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"ch" text,
	"place" integer NOT NULL,
	"won" boolean NOT NULL,
	"kills" integer NOT NULL,
	"boxes" integer NOT NULL,
	"trophy_delta" integer NOT NULL,
	"coins" integer NOT NULL,
	"xp" integer NOT NULL,
	CONSTRAINT "match_players_match_id_account_id_pk" PRIMARY KEY("match_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode" text NOT NULL,
	"seed" integer NOT NULL,
	"ticks" integer NOT NULL,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"imported" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trophies" (
	"account_id" uuid NOT NULL,
	"ch" text NOT NULL,
	"trophies" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "trophies_account_id_ch_pk" PRIMARY KEY("account_id","ch")
);
--> statement-breakpoint
ALTER TABLE "daily_scores" ADD CONSTRAINT "daily_scores_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trophies" ADD CONSTRAINT "trophies_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_day_ticks" ON "daily_scores" USING btree ("day","ticks");--> statement-breakpoint
CREATE INDEX "match_players_account" ON "match_players" USING btree ("account_id");
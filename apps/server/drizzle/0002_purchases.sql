CREATE TABLE "purchases" (
	"tx_id" text PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"product" text NOT NULL,
	"store" text NOT NULL,
	"sandbox" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"refunded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchases_account" ON "purchases" USING btree ("account_id");
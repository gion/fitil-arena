CREATE TABLE "offline_claims" (
	"day" text NOT NULL,
	"account_id" uuid NOT NULL,
	"n" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "offline_claims_day_account_id_pk" PRIMARY KEY("day","account_id")
);
--> statement-breakpoint
ALTER TABLE "offline_claims" ADD CONSTRAINT "offline_claims_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
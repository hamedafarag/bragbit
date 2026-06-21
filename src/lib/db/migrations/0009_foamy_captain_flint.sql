CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text,
	"count" integer,
	"last_request" bigint
);
--> statement-breakpoint
CREATE TABLE "rate_limit_hits" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rate_limit_hits_key_at_idx" ON "rate_limit_hits" USING btree ("key","at");
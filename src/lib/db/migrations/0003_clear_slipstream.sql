CREATE TABLE "attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"brag_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_brag_id_brags_id_fk" FOREIGN KEY ("brag_id") REFERENCES "public"."brags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_brag_idx" ON "attachments" USING btree ("brag_id");
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"period_start" date,
	"period_end" date,
	"goals_md" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brags" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"title" text NOT NULL,
	"description_md" text,
	"impact_md" text,
	"date" date DEFAULT CURRENT_DATE NOT NULL,
	"category" text,
	"status" text,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"collaborators" text[],
	"attribution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brag_links" (
	"id" text PRIMARY KEY NOT NULL,
	"brag_id" text NOT NULL,
	"url" text NOT NULL,
	"label" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brag_tags" (
	"brag_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "brag_tags_brag_id_tag_id_pk" PRIMARY KEY("brag_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brags" ADD CONSTRAINT "brags_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brag_links" ADD CONSTRAINT "brag_links_brag_id_brags_id_fk" FOREIGN KEY ("brag_id") REFERENCES "public"."brags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brag_tags" ADD CONSTRAINT "brag_tags_brag_id_brags_id_fk" FOREIGN KEY ("brag_id") REFERENCES "public"."brags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brag_tags" ADD CONSTRAINT "brag_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_workspace_user_idx" ON "documents" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "brags_document_date_idx" ON "brags" USING btree ("document_id","date");--> statement-breakpoint
CREATE INDEX "brag_links_brag_idx" ON "brag_links" USING btree ("brag_id");--> statement-breakpoint
CREATE INDEX "brag_tags_tag_idx" ON "brag_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_workspace_name_idx" ON "tags" USING btree ("user_id","workspace_id","name");
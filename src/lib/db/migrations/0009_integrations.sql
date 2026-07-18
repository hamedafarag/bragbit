CREATE TABLE "import_candidate" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"external_url" text NOT NULL,
	"source_type" text NOT NULL,
	"title" text NOT NULL,
	"suggested_category" text,
	"occurred_at" timestamp with time zone,
	"payload" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"brag_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"provider" text NOT NULL,
	"auth_type" text NOT NULL,
	"external_account_id" text,
	"external_account_label" text,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"scopes" text,
	"config" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_candidate" ADD CONSTRAINT "import_candidate_connection_id_integration_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_candidate" ADD CONSTRAINT "import_candidate_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_candidate" ADD CONSTRAINT "import_candidate_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_candidate" ADD CONSTRAINT "import_candidate_brag_id_brags_id_fk" FOREIGN KEY ("brag_id") REFERENCES "public"."brags"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connection" ADD CONSTRAINT "integration_connection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connection" ADD CONSTRAINT "integration_connection_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "import_candidate_user_provider_external_idx" ON "import_candidate" USING btree ("user_id","provider","external_id");--> statement-breakpoint
CREATE INDEX "import_candidate_connection_idx" ON "import_candidate" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "import_candidate_brag_idx" ON "import_candidate" USING btree ("brag_id");--> statement-breakpoint
CREATE INDEX "import_candidate_queue_idx" ON "import_candidate" USING btree ("user_id","workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_connection_user_workspace_provider_idx" ON "integration_connection" USING btree ("user_id","workspace_id","provider");
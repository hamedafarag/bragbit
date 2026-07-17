import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { brag } from "./brag";
import { idColumn, timestamps } from "./columns";
import { organization } from "./workspace";

// Source integrations (docs/specs/integrations.md). A user connects their own
// provider account (v1: GitHub) and imports their shipped work as candidate brags
// they review. Two tables, both workspace-scoped (per the index.ts convention):
//   integration_connection  a user's linked provider account, tokens encrypted
//   import_candidate         a fetched item awaiting review (the approve queue)
//
// `provider` / `auth_type` / `status` / `source_type` are free-form text validated
// in app code (the house convention — cf. brag.category, member.role), not Postgres
// enums, so adding Linear/Jira later is additive. Tokens are stored as AES-256-GCM
// ciphertext (features/integrations/crypto.ts), never plaintext. `config` / `payload`
// hold provider extras as JSON serialized to a string (like organization.metadata).

/**
 * A user's linked provider account, scoped to one workspace. The access/refresh
 * tokens are encrypted at rest. `authType` distinguishes the OAuth flow ('oauth')
 * from a pasted personal-access-token ('pat', no refresh, no expiry). Unique per
 * (user, workspace, provider) — one connection each. Deleting the user or the
 * workspace cascades the connection (and its candidates).
 */
export const integrationConnection = pgTable(
  "integration_connection",
  {
    id: idColumn(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // 'github' (v1); validated in app code
    authType: text("auth_type").notNull(), // 'oauth' | 'pat'
    externalAccountId: text("external_account_id"), // the provider's user id
    externalAccountLabel: text("external_account_label"), // e.g. the GitHub login
    accessToken: text("access_token").notNull(), // AES-256-GCM ciphertext
    refreshToken: text("refresh_token"), // encrypted when present (null for PAT / non-expiring OAuth)
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    scopes: text("scopes"), // space-delimited granted scopes
    config: text("config"), // provider extras as JSON (e.g. Jira cloudId, repo filters)
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("integration_connection_user_workspace_provider_idx").on(
      t.userId,
      t.workspaceId,
      t.provider,
    ),
  ],
);

/**
 * A fetched item awaiting review — the approve-each-entry queue. The unique
 * (user, provider, external_id) makes re-import idempotent: a PR already seen —
 * whether approved OR dismissed — is skipped, so the future weekly cron needs no
 * rework. Approving materializes a brag and stores its id here (status → 'approved');
 * deleting that brag sets `bragId` null but leaves the row, so it is not re-suggested.
 * `userId` / `workspaceId` are denormalized from the connection so the review-queue
 * query (and offboard purge) is a single-table, DAL-scoped filter.
 */
export const importCandidate = pgTable(
  "import_candidate",
  {
    id: idColumn(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => integrationConnection.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(), // e.g. the PR node id
    externalUrl: text("external_url").notNull(), // deep link back to the source
    sourceType: text("source_type").notNull(), // 'pull_request' (v1)
    title: text("title").notNull(),
    suggestedCategory: text("suggested_category"), // a brag category (optional)
    occurredAt: timestamp("occurred_at", { withTimezone: true }), // e.g. PR merged_at
    payload: text("payload"), // raw source subset as JSON (for editing on approve)
    status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'dismissed'
    bragId: text("brag_id").references(() => brag.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    // Dedup across re-imports (also the natural per-user lookup, userId leading).
    uniqueIndex("import_candidate_user_provider_external_idx").on(
      t.userId,
      t.provider,
      t.externalId,
    ),
    index("import_candidate_connection_idx").on(t.connectionId),
    index("import_candidate_brag_idx").on(t.bragId),
    // The review queue: pending candidates for a user in a workspace.
    index("import_candidate_queue_idx").on(t.userId, t.workspaceId, t.status),
  ],
);

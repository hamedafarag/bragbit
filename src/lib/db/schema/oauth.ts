import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

// OAuth 2.1 provider tables for the Better Auth `mcp` plugin (which reuses the
// oidc-provider schema). The MCP connector (docs/specs/mcp-connector.md) lets a
// user authorize an AI client (Claude Desktop / claude.ai) via OAuth instead of
// pasting a token. These mirror better-auth's oidc-provider schema field-for-field:
//   node_modules/better-auth/dist/plugins/oidc-provider/schema.mjs
// As with auth.ts, property keys are the camelCase logical field names Better Auth
// resolves at runtime (`casing: "snake_case"` maps them to snake_case columns);
// Better Auth generates the ids, so `id` has no app-side default. Do NOT rename keys.

/** A registered OAuth client — created by dynamic client registration when an AI assistant connects. */
export const oauthApplication = pgTable(
  "oauth_application",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    icon: text("icon"),
    metadata: text("metadata"),
    clientId: text("client_id").notNull().unique(),
    clientSecret: text("client_secret"),
    redirectUrls: text("redirect_urls").notNull(),
    type: text("type").notNull(),
    disabled: boolean("disabled").notNull().default(false),
    // The user who registered the client (nullable for pre-provisioned clients).
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("oauth_application_user_id_idx").on(t.userId)],
);

/** An issued access/refresh token pair, scoped to a client + user + granted scopes. */
export const oauthAccessToken = pgTable(
  "oauth_access_token",
  {
    id: text("id").primaryKey(),
    accessToken: text("access_token").notNull().unique(),
    refreshToken: text("refresh_token").notNull().unique(),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }).notNull(),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }).notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthApplication.clientId, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    scopes: text("scopes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("oauth_access_token_client_id_idx").on(t.clientId),
    index("oauth_access_token_user_id_idx").on(t.userId),
  ],
);

/** A user's standing consent for a client's scopes — so re-authorization skips the prompt. */
export const oauthConsent = pgTable(
  "oauth_consent",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthApplication.clientId, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    scopes: text("scopes").notNull(),
    consentGiven: boolean("consent_given").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("oauth_consent_client_id_idx").on(t.clientId),
    index("oauth_consent_user_id_idx").on(t.userId),
  ],
);

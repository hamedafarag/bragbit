import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { idColumn } from "./columns";
import { document } from "./document";

/**
 * A revocable share link for a document (PLAN.md §5/§6). The `token` is a random
 * base64url secret (the only credential — the link works for anyone with the URL,
 * no login); it's unique-indexed for fast public lookup. `passwordHash` is an
 * optional argon2 hash (Phase 6.4); `revokedAt` set = the link 404s;
 * `lastAccessedAt` is bumped on each successful view and shown to the owner.
 * Public share queries filter `visibility = 'shared'` so private brags never leak.
 */
export const shareLink = pgTable("share_links", {
  id: idColumn(),
  documentId: text("document_id")
    .notNull()
    .references(() => document.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  passwordHash: text("password_hash"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
});

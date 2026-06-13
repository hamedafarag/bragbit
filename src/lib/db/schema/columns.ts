import { timestamp, text } from "drizzle-orm/pg-core";

/**
 * Shared column helpers that establish BragBit's schema conventions. Domain
 * tables (Phase 1+) compose these so every table gets consistent IDs and
 * timestamps.
 */

/** Primary key: an application-generated random UUID (no DB extension needed). */
export const idColumn = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

/** `created_at` / `updated_at`, timezone-aware; `updated_at` bumps on write. */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

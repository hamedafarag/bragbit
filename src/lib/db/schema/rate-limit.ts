import { bigint, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { idColumn } from "./columns";

/**
 * Shared rate-limit storage for the hosted instance (ENH-SEC-02). The moment hosted
 * runs more than one app instance, in-process limiters weaken N×, so both limiters
 * move to a store every instance sees — here Postgres (the one we already run),
 * gated to `INSTANCE_MODE=hosted`. The private (single-container) self-host keeps the
 * in-process limiters, so this table stays empty there.
 */

/**
 * Better Auth's built-in per-IP auth limiter, via `rateLimit.storage: "database"`.
 * Better Auth owns this table — `key` / `count` / `lastRequest` are its field names
 * (do not rename). `lastRequest` is a millisecond epoch.
 */
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key"),
  count: integer("count"),
  lastRequest: bigint("last_request", { mode: "number" }),
});

/**
 * BragBit's own sliding-window limiter (share-unlock, invite-register) — one row per
 * attempt, expired rows swept on each check (`lib/rate-limit-pg`). The (key, at)
 * index serves the per-key window scan.
 */
export const rateLimitHit = pgTable(
  "rate_limit_hits",
  {
    id: idColumn(),
    key: text("key").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull(),
  },
  (t) => [index("rate_limit_hits_key_at_idx").on(t.key, t.at)],
);

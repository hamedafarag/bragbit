import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { timestamps } from "./columns";

/**
 * Per-user profile (PLAN.md §5). One row per user, keyed by the Better Auth
 * user id (cascades on account deletion). Holds the in-app identity — display
 * name, role title, team, bio — and the avatar storage key. The `reminder_*`
 * columns are defined here now but only wired up in Phase 8; `display_name` is
 * mirrored to Better Auth `user.name` on save so auth/email surfaces stay
 * consistent. This table is owned by BragBit (not Better Auth) and read/written
 * only through the profile feature module.
 */
export const profile = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  roleTitle: text("role_title"),
  team: text("team"),
  bio: text("bio"),
  avatarKey: text("avatar_key"),
  // Phase 8 (opt-in weekly reminders) — columns defined now, no UI yet.
  reminderEnabled: boolean("reminder_enabled").notNull().default(false),
  reminderDay: integer("reminder_day"), // 0–6 (Sun–Sat)
  timezone: text("timezone"),
  ...timestamps,
});

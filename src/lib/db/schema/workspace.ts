import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

// Better Auth organization plugin tables. BragBit models a "workspace" as a
// Better Auth organization; `type` distinguishes a personal workspace (one
// member) from an organization. Per Better Auth's schema these have NO
// updatedAt column. `type`, `accentColor`, `logoKey` are BragBit additions
// (registered as organization additionalFields in lib/auth).

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  metadata: text("metadata"), // JSON serialized as a string
  // --- BragBit workspace fields ---
  type: text("type").notNull().default("organization"), // 'personal' | 'organization'
  accentColor: text("accent_color"),
  logoKey: text("logo_key"),
});

export const member = pgTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // 'owner' | 'admin' | 'member'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").notNull().default("pending"), // pending | accepted | rejected | canceled
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

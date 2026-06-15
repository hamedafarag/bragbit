import { sql } from "drizzle-orm";
import { date, index, integer, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { idColumn, timestamps } from "./columns";
import { document } from "./document";
import { organization } from "./workspace";

/**
 * A brag — a single logged win inside a document (PLAN.md §5). Brags are scoped
 * through their parent document (which carries the workspace + owner); there's no
 * direct workspace column, so every brag query joins or pre-resolves the parent
 * document through the DAL. Deleting a document cascades its brags.
 *
 * `category` / `status` / `visibility` are free-form text validated in app code
 * (the house convention — see member.role / organization.type), not Postgres
 * enums. `date` is a calendar date (string mode), defaulting to today.
 *
 * Brags CRUD + the <30s quick-add flow land in the next Phase 3 slice; the table
 * is defined now so the whole Phase 3 schema ships in one migration. The
 * generated `search` tsvector column + its GIN index are deferred to Phase 5
 * (full-text search), where they're explicitly scoped.
 */
export const brag = pgTable(
  "brags",
  {
    id: idColumn(),
    documentId: text("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    descriptionMd: text("description_md"),
    impactMd: text("impact_md"),
    date: date("date", { mode: "string" })
      .notNull()
      .default(sql`CURRENT_DATE`),
    category: text("category"), // one of the fixed taxonomy (§5), optional
    status: text("status"), // 'shipped' | 'in_progress', optional
    visibility: text("visibility").notNull().default("shared"), // 'shared' | 'private'
    collaborators: text("collaborators").array(),
    attribution: text("attribution"), // who gave the recognition (recognition brags)
    ...timestamps,
  },
  // Timeline order within a document (§6 performance). FK on document_id is
  // covered by this composite's leading column.
  (t) => [index("brags_document_date_idx").on(t.documentId, t.date)],
);

/** External links attached to a brag (a PR, doc, dashboard…), ordered by position. */
export const bragLink = pgTable(
  "brag_links",
  {
    id: idColumn(),
    bragId: text("brag_id")
      .notNull()
      .references(() => brag.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    label: text("label"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("brag_links_brag_idx").on(t.bragId)],
);

/** Tags are scoped per user per workspace; monochrome in v1 (no color — §4/§5). */
export const tag = pgTable(
  "tags",
  {
    id: idColumn(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  // One row per (user, workspace, name) so inline tag creation is idempotent.
  (t) => [uniqueIndex("tags_user_workspace_name_idx").on(t.userId, t.workspaceId, t.name)],
);

/** Brag ↔ tag join (PLAN.md §5): composite PK, plus a tag index for filtering brags by tag. */
export const bragTag = pgTable(
  "brag_tags",
  {
    bragId: text("brag_id")
      .notNull()
      .references(() => brag.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.bragId, t.tagId] }), index("brag_tags_tag_idx").on(t.tagId)],
);

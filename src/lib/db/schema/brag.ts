import { sql, type SQL } from "drizzle-orm";
import {
  customType,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { idColumn, timestamps } from "./columns";
import { document } from "./document";
import { organization } from "./workspace";

/** Postgres `tsvector` (no built-in Drizzle type) for the generated FTS column. */
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

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
 * `search` is a generated `tsvector` over title (weight A), impact (B), and
 * description (C); Postgres keeps it in sync on write, and a GIN index backs the
 * workspace full-text search (features/brag `searchBrags`).
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
    // Generated FTS vector (weighted title/impact/description); GIN-indexed below.
    search: tsvector("search").generatedAlwaysAs(
      (): SQL =>
        sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(impact_md, '')), 'B') || setweight(to_tsvector('english', coalesce(description_md, '')), 'C')`,
    ),
    ...timestamps,
  },
  // Timeline order within a document (§6 performance); GIN over the FTS vector.
  // The FK on document_id is covered by the composite's leading column.
  (t) => [
    index("brags_document_date_idx").on(t.documentId, t.date),
    index("brags_search_idx").using("gin", t.search),
  ],
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

/**
 * A file attached to a brag (screenshot, PDF, praise email…). The object lives in
 * the storage adapter under `{workspaceId}/attachments/…`; this row keeps the
 * storage key plus display metadata. Attachments are immutable once uploaded (no
 * `updated_at`) and never publicly addressable — the authorizing file route
 * streams them (PLAN.md §6). The row cascades when its brag is deleted; the
 * stored object is removed explicitly by the delete action.
 */
export const attachment = pgTable(
  "attachments",
  {
    id: idColumn(),
    bragId: text("brag_id")
      .notNull()
      .references(() => brag.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("attachments_brag_idx").on(t.bragId)],
);

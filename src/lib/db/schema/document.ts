import { date, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { idColumn, timestamps } from "./columns";
import { organization } from "./workspace";

/**
 * A document is a review period — "2026", "H1 2026", "Promo case" (PLAN.md §5).
 * It's workspace-scoped AND owned by one user: every row carries both the
 * workspace and the owning user, and is only ever read/written through the DAL
 * (features/document checks the caller's membership + ownership on every
 * operation). Brags hang off a document; deleting one cascades them.
 *
 * `archivedAt` is a BragBit addition beyond the §5 sketch — it backs the
 * archive/delete document operation (Phase 3): archiving drops a document out of
 * the dashboard listing without destroying it; deleting removes it (and its
 * brags) for good. Period bounds are calendar dates (string mode, "YYYY-MM-DD")
 * so they stay timezone-stable.
 */
export const document = pgTable(
  "documents",
  {
    id: idColumn(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    periodStart: date("period_start", { mode: "string" }),
    periodEnd: date("period_end", { mode: "string" }),
    goalsMd: text("goals_md"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  // The dashboard lists a caller's documents within their active workspace.
  (t) => [index("documents_workspace_user_idx").on(t.workspaceId, t.userId)],
);

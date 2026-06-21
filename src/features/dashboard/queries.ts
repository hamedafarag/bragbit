import "server-only";

import { and, count, eq, gte } from "drizzle-orm";

import { requireWorkspace } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { brag, document } from "@/lib/db/schema";

import type { ActivityCount } from "./activity";

/**
 * Per-day win counts for the caller, across all their documents in the active
 * workspace, from `since` (inclusive) onward — the data behind the dashboard
 * heatmap. Scoped through the parent document (workspace + owner) like the other
 * brag queries, so it never crosses tenants or users. Includes private brags:
 * it's the owner's own activity view, not a shared surface.
 */
export async function getActivityCounts(since: string): Promise<ActivityCount[]> {
  const { workspaceId, user } = await requireWorkspace();
  const rows = await db
    .select({ date: brag.date, n: count() })
    .from(brag)
    .innerJoin(document, eq(document.id, brag.documentId))
    .where(
      and(
        eq(document.workspaceId, workspaceId),
        eq(document.userId, user.id),
        gte(brag.date, since),
      ),
    )
    .groupBy(brag.date);
  return rows.map((r) => ({ date: r.date, count: Number(r.n) }));
}

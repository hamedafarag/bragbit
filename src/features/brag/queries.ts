import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { requireWorkspace } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { brag, document } from "@/lib/db/schema";

export type BragRow = typeof brag.$inferSelect;

/**
 * Brags in a document the caller owns, newest first. Scoped through the parent
 * document (which carries the workspace + owner) via the join, so a documentId
 * from another workspace or another user returns nothing.
 */
export async function listBrags(documentId: string): Promise<BragRow[]> {
  const { workspaceId, user } = await requireWorkspace();
  const rows = await db
    .select()
    .from(brag)
    .innerJoin(document, eq(document.id, brag.documentId))
    .where(
      and(
        eq(brag.documentId, documentId),
        eq(document.workspaceId, workspaceId),
        eq(document.userId, user.id),
      ),
    )
    .orderBy(desc(brag.date), desc(brag.createdAt));
  return rows.map((r) => r.brags);
}

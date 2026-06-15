import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { requireWorkspace } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { brag, bragLink, document } from "@/lib/db/schema";

export type BragRow = typeof brag.$inferSelect;
export type BragLinkRow = typeof bragLink.$inferSelect;
export type BragWithLinks = BragRow & { links: BragLinkRow[] };

/**
 * Brags in a document the caller owns, newest first, each with its links. Scoped
 * through the parent document (which carries the workspace + owner) via the join,
 * so a documentId from another workspace or user returns nothing. Links load in a
 * second query keyed by the already-scoped brag ids (no per-brag N+1).
 */
export async function listBrags(documentId: string): Promise<BragWithLinks[]> {
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
  const brags = rows.map((r) => r.brags);
  if (brags.length === 0) return [];

  const links = await db
    .select()
    .from(bragLink)
    .where(
      inArray(
        bragLink.bragId,
        brags.map((b) => b.id),
      ),
    )
    .orderBy(asc(bragLink.position));

  const byBrag = new Map<string, BragLinkRow[]>();
  for (const link of links) {
    const list = byBrag.get(link.bragId);
    if (list) list.push(link);
    else byBrag.set(link.bragId, [link]);
  }

  return brags.map((b) => ({ ...b, links: byBrag.get(b.id) ?? [] }));
}

import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import type { AttachmentRow } from "@/features/attachment/queries";
import { requireWorkspace } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { attachment, brag, bragLink, document } from "@/lib/db/schema";

export type BragRow = typeof brag.$inferSelect;
export type BragLinkRow = typeof bragLink.$inferSelect;
export type BragWithRelations = BragRow & { links: BragLinkRow[]; attachments: AttachmentRow[] };

function groupByBragId<T extends { bragId: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.bragId);
    if (list) list.push(row);
    else map.set(row.bragId, [row]);
  }
  return map;
}

/**
 * Brags in a document the caller owns, newest first, each with its links and
 * attachments. Scoped through the parent document (which carries the workspace +
 * owner) via the join, so a documentId from another workspace or user returns
 * nothing. Links and attachments load in batched queries keyed by the
 * already-scoped brag ids (no per-brag N+1).
 */
export async function listBrags(documentId: string): Promise<BragWithRelations[]> {
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

  const ids = brags.map((b) => b.id);
  const [links, attachments] = await Promise.all([
    db.select().from(bragLink).where(inArray(bragLink.bragId, ids)).orderBy(asc(bragLink.position)),
    db
      .select()
      .from(attachment)
      .where(inArray(attachment.bragId, ids))
      .orderBy(asc(attachment.createdAt)),
  ]);

  const linksByBrag = groupByBragId(links);
  const attachmentsByBrag = groupByBragId(attachments);
  return brags.map((b) => ({
    ...b,
    links: linksByBrag.get(b.id) ?? [],
    attachments: attachmentsByBrag.get(b.id) ?? [],
  }));
}

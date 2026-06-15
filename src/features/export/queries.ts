import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import type { BragWithRelations } from "@/features/brag/queries";
import { db } from "@/lib/db";
import { attachment, brag, bragLink, bragTag, document, tag } from "@/lib/db/schema";

import type { ExportDocumentData } from "./markdown";

export type ExportDocument = ExportDocumentData;

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
 * A document the caller owns plus its brags, for export. Scoped explicitly by
 * `workspaceId + userId` (the route resolves them via getWorkspaceOrNull, so this
 * works outside a redirecting guard — like getOwnedAttachmentByKey). Documents are
 * private per user, so an unowned/cross-tenant id yields null. `includePrivate`
 * gates private brags (owner-only choice, default off upstream); otherwise only
 * `visibility = 'shared'` brags are returned. Relations batch-load (no N+1).
 */
export async function getDocumentForExport(
  documentId: string,
  scope: { workspaceId: string; userId: string },
  includePrivate: boolean,
): Promise<ExportDocument | null> {
  const [doc] = await db
    .select({
      title: document.title,
      description: document.description,
      periodStart: document.periodStart,
      periodEnd: document.periodEnd,
      goalsMd: document.goalsMd,
    })
    .from(document)
    .where(
      and(
        eq(document.id, documentId),
        eq(document.workspaceId, scope.workspaceId),
        eq(document.userId, scope.userId),
      ),
    )
    .limit(1);
  if (!doc) return null;

  const conditions = [eq(brag.documentId, documentId)];
  if (!includePrivate) conditions.push(eq(brag.visibility, "shared"));
  const bragRows = await db
    .select()
    .from(brag)
    .where(and(...conditions))
    .orderBy(desc(brag.date), desc(brag.createdAt));

  const ids = bragRows.map((b) => b.id);
  let brags: BragWithRelations[] = [];
  if (ids.length > 0) {
    const [links, attachments, tagRows] = await Promise.all([
      db
        .select()
        .from(bragLink)
        .where(inArray(bragLink.bragId, ids))
        .orderBy(asc(bragLink.position)),
      db
        .select()
        .from(attachment)
        .where(inArray(attachment.bragId, ids))
        .orderBy(asc(attachment.createdAt)),
      db
        .select({ bragId: bragTag.bragId, name: tag.name })
        .from(bragTag)
        .innerJoin(tag, eq(tag.id, bragTag.tagId))
        .where(inArray(bragTag.bragId, ids))
        .orderBy(asc(tag.name)),
    ]);
    const linksByBrag = groupByBragId(links);
    const attachmentsByBrag = groupByBragId(attachments);
    const tagsByBrag = groupByBragId(tagRows);
    brags = bragRows.map((b) => ({
      ...b,
      links: linksByBrag.get(b.id) ?? [],
      attachments: attachmentsByBrag.get(b.id) ?? [],
      tags: (tagsByBrag.get(b.id) ?? []).map((t) => t.name),
    }));
  }

  return { ...doc, brags };
}

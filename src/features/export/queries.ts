import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import type { BragWithRelations } from "@/features/brag/queries";
import type { DocumentRow } from "@/features/document/queries";
import { db } from "@/lib/db";
import {
  attachment,
  brag,
  bragLink,
  bragTag,
  document,
  organization,
  profile,
  tag,
} from "@/lib/db/schema";

import type { DataExportInput } from "./json";
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

/** Attach links/attachments/tags to already-fetched brag rows in batched queries (no N+1). */
async function attachRelations(
  bragRows: (typeof brag.$inferSelect)[],
): Promise<BragWithRelations[]> {
  const ids = bragRows.map((b) => b.id);
  if (ids.length === 0) return [];
  const [links, attachments, tagRows] = await Promise.all([
    db.select().from(bragLink).where(inArray(bragLink.bragId, ids)).orderBy(asc(bragLink.position)),
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
  return bragRows.map((b) => ({
    ...b,
    links: linksByBrag.get(b.id) ?? [],
    attachments: attachmentsByBrag.get(b.id) ?? [],
    tags: (tagsByBrag.get(b.id) ?? []).map((t) => t.name),
  }));
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

  return { ...doc, brags: await attachRelations(bragRows) };
}

/**
 * The caller's entire dataset in the active workspace, for the full-portability
 * JSON export (PLAN §7). Scoped explicitly by `workspaceId + userId` (route-driven,
 * like getDocumentForExport). Includes ALL documents — archived too — and ALL
 * brags regardless of visibility (it's the owner's own copy, not a share), with
 * relations batched across every brag at once (no N+1). The shaper (toDataExport)
 * turns this into the export contract.
 */
export async function getAllDataForExport(scope: {
  workspaceId: string;
  userId: string;
  email: string;
}): Promise<Omit<DataExportInput, "exportedAt">> {
  const [ws] = await db
    .select({ name: organization.name, type: organization.type })
    .from(organization)
    .where(eq(organization.id, scope.workspaceId))
    .limit(1);
  const [prof] = await db
    .select({ displayName: profile.displayName })
    .from(profile)
    .where(eq(profile.userId, scope.userId))
    .limit(1);

  const docs: DocumentRow[] = await db
    .select()
    .from(document)
    .where(and(eq(document.workspaceId, scope.workspaceId), eq(document.userId, scope.userId)))
    .orderBy(desc(document.createdAt));

  const byDoc = new Map<string, BragWithRelations[]>();
  if (docs.length > 0) {
    const bragRows = await db
      .select()
      .from(brag)
      .where(
        inArray(
          brag.documentId,
          docs.map((d) => d.id),
        ),
      )
      .orderBy(desc(brag.date), desc(brag.createdAt));
    for (const b of await attachRelations(bragRows)) {
      const list = byDoc.get(b.documentId);
      if (list) list.push(b);
      else byDoc.set(b.documentId, [b]);
    }
  }

  return {
    workspace: { name: ws?.name ?? "", type: ws?.type ?? "organization" },
    account: { email: scope.email, displayName: prof?.displayName ?? null },
    documents: docs.map((d) => ({ document: d, brags: byDoc.get(d.id) ?? [] })),
  };
}

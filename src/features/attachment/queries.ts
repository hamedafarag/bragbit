import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { attachment, brag, document } from "@/lib/db/schema";

export type AttachmentRow = typeof attachment.$inferSelect;

/**
 * Whether `bragId` belongs to a document owned by `userId` in `workspaceId`.
 * Route-handler helper (the upload route uses the non-redirecting guard, then
 * checks ownership here before storing files against the brag).
 */
export async function isBragOwnedBy(
  bragId: string,
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: brag.id })
    .from(brag)
    .innerJoin(document, eq(document.id, brag.documentId))
    .where(
      and(eq(brag.id, bragId), eq(document.workspaceId, workspaceId), eq(document.userId, userId)),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * The attachment with this storage key, but only if `userId` owns it (via
 * brag → document). The authorizing file route uses this: workspace membership
 * isn't enough for attachments (they're private per user, like brags), so this
 * scopes to the owner. The Phase 6 share route will add a valid-token path.
 */
export async function getOwnedAttachmentByKey(
  storageKey: string,
  userId: string,
): Promise<AttachmentRow | null> {
  const [row] = await db
    .select()
    .from(attachment)
    .innerJoin(brag, eq(brag.id, attachment.bragId))
    .innerJoin(document, eq(document.id, brag.documentId))
    .where(and(eq(attachment.storageKey, storageKey), eq(document.userId, userId)))
    .limit(1);
  return row ? row.attachments : null;
}

/**
 * Storage keys of every attachment on a brag the caller owns (scoped via
 * brag → document, like the queries above). `deleteBrag` collects these *before*
 * deleting the brag: the row's `ON DELETE CASCADE` drops the attachment rows but
 * never the stored objects, so the action purges the objects afterward. Returns
 * `[]` for a brag the caller doesn't own — nothing to purge.
 */
export async function ownedAttachmentKeysForBrag(
  bragId: string,
  workspaceId: string,
  userId: string,
): Promise<string[]> {
  const rows = await db
    .select({ storageKey: attachment.storageKey })
    .from(attachment)
    .innerJoin(brag, eq(brag.id, attachment.bragId))
    .innerJoin(document, eq(document.id, brag.documentId))
    .where(
      and(
        eq(attachment.bragId, bragId),
        eq(document.workspaceId, workspaceId),
        eq(document.userId, userId),
      ),
    );
  return rows.map((r) => r.storageKey);
}

/**
 * Storage keys of every attachment under a document the caller owns, across all
 * its brags (attachments → brags → the document). The document-level sibling of
 * `ownedAttachmentKeysForBrag`: `deleteDocument` collects these before the delete
 * cascades documents → brags → attachments, then purges the orphaned objects.
 * Returns `[]` for a document the caller doesn't own.
 */
export async function ownedAttachmentKeysForDocument(
  documentId: string,
  workspaceId: string,
  userId: string,
): Promise<string[]> {
  const rows = await db
    .select({ storageKey: attachment.storageKey })
    .from(attachment)
    .innerJoin(brag, eq(brag.id, attachment.bragId))
    .innerJoin(document, eq(document.id, brag.documentId))
    .where(
      and(
        eq(document.id, documentId),
        eq(document.workspaceId, workspaceId),
        eq(document.userId, userId),
      ),
    );
  return rows.map((r) => r.storageKey);
}

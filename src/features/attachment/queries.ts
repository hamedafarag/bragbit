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

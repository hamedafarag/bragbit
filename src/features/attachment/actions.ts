"use server";

import { and, eq } from "drizzle-orm";

import { requireWorkspace } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { attachment, brag, document } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Delete an attachment the caller owns (scoped via brag → document). The DB row
 * goes first, then the stored object is removed best-effort (a leftover object is
 * harmless and reclaimable; a dangling row would not be). Uploads come in through
 * the multipart route, not a Server Action.
 */
export async function deleteAttachment(attachmentId: string): Promise<ActionResult> {
  const { workspaceId, user } = await requireWorkspace();

  const [row] = await db
    .select({ storageKey: attachment.storageKey })
    .from(attachment)
    .innerJoin(brag, eq(brag.id, attachment.bragId))
    .innerJoin(document, eq(document.id, brag.documentId))
    .where(
      and(
        eq(attachment.id, attachmentId),
        eq(document.workspaceId, workspaceId),
        eq(document.userId, user.id),
      ),
    )
    .limit(1);
  if (!row) return { ok: false, error: "Attachment not found." };

  await db.delete(attachment).where(eq(attachment.id, attachmentId));
  await getStorage()
    .delete(row.storageKey)
    .catch(() => {});
  return { ok: true };
}

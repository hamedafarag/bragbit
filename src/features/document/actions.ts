"use server";

import { and, eq } from "drizzle-orm";

import { ownedAttachmentKeysForDocument } from "@/features/attachment/queries";
import { requireWorkspace } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { document } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";

import { documentSchema, type DocumentInput } from "./schema";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

const orNull = (v: string) => (v.trim() === "" ? null : v.trim());

/** Validated form input → document column values (empty optional fields → null). */
function toFields(data: DocumentInput) {
  return {
    title: data.title,
    description: orNull(data.description),
    periodStart: orNull(data.periodStart),
    periodEnd: orNull(data.periodEnd),
    goalsMd: orNull(data.goalsMd),
  };
}

/**
 * Create a document in the caller's active workspace, owned by the caller. Any
 * member may create their own documents — documents are private per user, so the
 * gate is membership (requireWorkspace), not a role. Returns the new id so the
 * client can navigate to it.
 */
export async function createDocument(input: DocumentInput): Promise<CreateResult> {
  const { workspaceId, user } = await requireWorkspace();

  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const [row] = await db
    .insert(document)
    .values({ workspaceId, userId: user.id, ...toFields(parsed.data) })
    .returning({ id: document.id });

  return { ok: true, id: row!.id };
}

/**
 * Update a document the caller owns. Ownership is enforced *in* the query — the
 * WHERE is scoped to the caller's workspace + user, so a mismatched id (another
 * workspace or another user) matches no row and reports not-found rather than
 * silently mutating someone else's data.
 */
export async function updateDocument(
  documentId: string,
  input: DocumentInput,
): Promise<ActionResult> {
  const { workspaceId, user } = await requireWorkspace();

  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const updated = await db
    .update(document)
    .set(toFields(parsed.data))
    .where(
      and(
        eq(document.id, documentId),
        eq(document.workspaceId, workspaceId),
        eq(document.userId, user.id),
      ),
    )
    .returning({ id: document.id });

  if (updated.length === 0) return { ok: false, error: "Document not found." };
  return { ok: true };
}

/** Set or clear a document's archived flag (caller-owned, workspace-scoped). */
async function setArchived(documentId: string, archivedAt: Date | null): Promise<ActionResult> {
  const { workspaceId, user } = await requireWorkspace();
  const updated = await db
    .update(document)
    .set({ archivedAt })
    .where(
      and(
        eq(document.id, documentId),
        eq(document.workspaceId, workspaceId),
        eq(document.userId, user.id),
      ),
    )
    .returning({ id: document.id });
  if (updated.length === 0) return { ok: false, error: "Document not found." };
  return { ok: true };
}

/** Archive a document — it drops out of the dashboard without being destroyed. */
export async function archiveDocument(documentId: string): Promise<ActionResult> {
  return setArchived(documentId, new Date());
}

/** Restore an archived document. */
export async function unarchiveDocument(documentId: string): Promise<ActionResult> {
  return setArchived(documentId, null);
}

/**
 * Permanently delete a document the caller owns; its brags (and their links, tag
 * associations, and attachment rows) cascade. The attachments' stored objects do
 * NOT cascade, so we collect every attachment key under the document first, delete
 * the document, then best-effort purge each object — otherwise deleting a document
 * would orphan its (possibly sensitive) uploads in storage. Scoped by workspace +
 * user in the WHERE so it can't reach across tenants or users; we purge only after
 * a successful owned delete.
 */
export async function deleteDocument(documentId: string): Promise<ActionResult> {
  const { workspaceId, user } = await requireWorkspace();
  const storageKeys = await ownedAttachmentKeysForDocument(documentId, workspaceId, user.id);
  const deleted = await db
    .delete(document)
    .where(
      and(
        eq(document.id, documentId),
        eq(document.workspaceId, workspaceId),
        eq(document.userId, user.id),
      ),
    )
    .returning({ id: document.id });
  if (deleted.length === 0) return { ok: false, error: "Document not found." };

  const storage = getStorage();
  await Promise.all(storageKeys.map((key) => storage.delete(key).catch(() => {})));
  return { ok: true };
}

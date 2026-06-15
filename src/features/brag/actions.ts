"use server";

import { and, asc, eq, exists, inArray } from "drizzle-orm";

import { ownedAttachmentKeysForBrag } from "@/features/attachment/queries";
import { requireWorkspace } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { brag, bragLink, bragTag, document, tag } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";

import {
  bragSchema,
  quickAddSchema,
  type BragInput,
  type BragLinkInput,
  type QuickAddInput,
} from "./schema";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

const orNull = (v: string) => (v.trim() === "" ? null : v.trim());

function splitCollaborators(v: string): string[] | null {
  const items = v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : null;
}

/** Validated editor input → brag column values (empty optionals → null). */
function toFields(data: BragInput) {
  return {
    title: data.title,
    date: data.date,
    category: orNull(data.category),
    status: orNull(data.status),
    descriptionMd: orNull(data.descriptionMd),
    impactMd: orNull(data.impactMd),
    collaborators: splitCollaborators(data.collaborators),
    attribution: orNull(data.attribution),
    visibility: data.visibility,
  };
}

/** Brag-link rows for an insert, positioned by their order in the editor. */
function linkValues(bragId: string, links: BragLinkInput[]) {
  return links.map((l, i) => ({
    bragId,
    url: l.url,
    label: l.label.trim() === "" ? null : l.label.trim(),
    position: i,
  }));
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Replace a brag's tags. Tags are shared per (user, workspace): each name is
 * create-or-found (case-normalized, deduped), then brag_tags is rewritten to the
 * given set. Removing a tag from a brag leaves the tag itself in the user's
 * vocabulary. Runs inside the create/update transaction.
 */
async function syncBragTags(
  tx: Tx,
  bragId: string,
  workspaceId: string,
  userId: string,
  names: string[],
): Promise<void> {
  await tx.delete(bragTag).where(eq(bragTag.bragId, bragId));
  const unique = [...new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean))];
  if (unique.length === 0) return;

  await tx
    .insert(tag)
    .values(unique.map((name) => ({ userId, workspaceId, name })))
    .onConflictDoNothing({ target: [tag.userId, tag.workspaceId, tag.name] });

  const tagRows = await tx
    .select({ id: tag.id })
    .from(tag)
    .where(
      and(eq(tag.userId, userId), eq(tag.workspaceId, workspaceId), inArray(tag.name, unique)),
    );

  await tx.insert(bragTag).values(tagRows.map((t) => ({ bragId, tagId: t.id })));
}

type OwnedDocument = { id: string; workspaceId: string; userId: string };

/** Verify the caller owns `documentId`; returns its id + the owning context, or null. */
async function ownedDocument(documentId: string): Promise<OwnedDocument | null> {
  const { workspaceId, user } = await requireWorkspace();
  const [doc] = await db
    .select({ id: document.id })
    .from(document)
    .where(
      and(
        eq(document.id, documentId),
        eq(document.workspaceId, workspaceId),
        eq(document.userId, user.id),
      ),
    )
    .limit(1);
  return doc ? { id: doc.id, workspaceId, userId: user.id } : null;
}

/**
 * EXISTS predicate scoping a brag to a document the caller owns — used in the
 * mutation WHERE so a brag in another workspace or owned by another user matches
 * no row (ownership enforced in the query, not just checked beforehand).
 */
function ownedBrag(workspaceId: string, userId: string) {
  return exists(
    db
      .select()
      .from(document)
      .where(
        and(
          eq(document.id, brag.documentId),
          eq(document.workspaceId, workspaceId),
          eq(document.userId, userId),
        ),
      ),
  );
}

/**
 * Quick-add — the product's soul. Title only (the client stamps today's date);
 * everything else stays empty and can be filled in later. Minimal friction, the
 * sub-30-second capture the whole genre lives or dies on. Returns the new id.
 */
export async function quickAddBrag(
  documentId: string,
  input: QuickAddInput,
): Promise<CreateResult> {
  const parsed = quickAddSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const owned = await ownedDocument(documentId);
  if (!owned) return { ok: false, error: "Document not found." };

  const [row] = await db
    .insert(brag)
    .values({ documentId: owned.id, title: parsed.data.title, date: parsed.data.date })
    .returning({ id: brag.id });
  return { ok: true, id: row!.id };
}

/** Create a fully-detailed brag from the editor. */
export async function createBrag(documentId: string, input: BragInput): Promise<CreateResult> {
  const parsed = bragSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const owned = await ownedDocument(documentId);
  if (!owned) return { ok: false, error: "Document not found." };

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(brag)
      .values({ documentId: owned.id, ...toFields(parsed.data) })
      .returning({ id: brag.id });
    const values = linkValues(row!.id, parsed.data.links);
    if (values.length > 0) await tx.insert(bragLink).values(values);
    await syncBragTags(tx, row!.id, owned.workspaceId, owned.userId, parsed.data.tags);
    return row!;
  });
  return { ok: true, id: created.id };
}

/**
 * Update a brag the caller owns and replace its links + tags. Ownership is
 * enforced in the UPDATE's WHERE (the correlated EXISTS) — if it matches no row,
 * nothing downstream runs, so we never touch the relations of a brag the caller
 * doesn't own. Links and tags are replaced wholesale.
 */
export async function updateBrag(bragId: string, input: BragInput): Promise<ActionResult> {
  const { workspaceId, user } = await requireWorkspace();
  const parsed = bragSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const ok = await db.transaction(async (tx) => {
    const updated = await tx
      .update(brag)
      .set(toFields(parsed.data))
      .where(and(eq(brag.id, bragId), ownedBrag(workspaceId, user.id)))
      .returning({ id: brag.id });
    if (updated.length === 0) return false;

    await tx.delete(bragLink).where(eq(bragLink.bragId, bragId));
    const values = linkValues(bragId, parsed.data.links);
    if (values.length > 0) await tx.insert(bragLink).values(values);
    await syncBragTags(tx, bragId, workspaceId, user.id, parsed.data.tags);
    return true;
  });
  if (!ok) return { ok: false, error: "Brag not found." };
  return { ok: true };
}

/**
 * Permanently delete a brag the caller owns. Its links, tag associations, and
 * attachment rows cascade — but the attachments' stored objects do not, so we
 * collect their storage keys first, delete the brag, then best-effort purge each
 * object (mirroring deleteAttachment: a leftover file is harmless and reclaimable,
 * but orphaning a user's sensitive upload is a delete-completeness/privacy bug).
 * Keys are collected only for a brag the caller owns; we purge only after a
 * successful owned delete, so we can never remove files for a brag we don't own.
 */
export async function deleteBrag(bragId: string): Promise<ActionResult> {
  const { workspaceId, user } = await requireWorkspace();
  const storageKeys = await ownedAttachmentKeysForBrag(bragId, workspaceId, user.id);
  const deleted = await db
    .delete(brag)
    .where(and(eq(brag.id, bragId), ownedBrag(workspaceId, user.id)))
    .returning({ id: brag.id });
  if (deleted.length === 0) return { ok: false, error: "Brag not found." };

  const storage = getStorage();
  await Promise.all(storageKeys.map((key) => storage.delete(key).catch(() => {})));
  return { ok: true };
}

/** The caller's tag names in the active workspace, for editor autocomplete. */
export async function getTagSuggestions(): Promise<string[]> {
  const { workspaceId, user } = await requireWorkspace();
  const rows = await db
    .select({ name: tag.name })
    .from(tag)
    .where(and(eq(tag.userId, user.id), eq(tag.workspaceId, workspaceId)))
    .orderBy(asc(tag.name));
  return rows.map((r) => r.name);
}

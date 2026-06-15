"use server";

import { and, eq, exists } from "drizzle-orm";

import { requireWorkspace } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { brag, bragLink, document } from "@/lib/db/schema";

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

/** Verify the caller owns `documentId` in their active workspace; returns its id or null. */
async function ownedDocumentId(documentId: string): Promise<string | null> {
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
  return doc?.id ?? null;
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
  const docId = await ownedDocumentId(documentId);
  if (!docId) return { ok: false, error: "Document not found." };

  const [row] = await db
    .insert(brag)
    .values({ documentId: docId, title: parsed.data.title, date: parsed.data.date })
    .returning({ id: brag.id });
  return { ok: true, id: row!.id };
}

/** Create a fully-detailed brag from the editor. */
export async function createBrag(documentId: string, input: BragInput): Promise<CreateResult> {
  const parsed = bragSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const docId = await ownedDocumentId(documentId);
  if (!docId) return { ok: false, error: "Document not found." };

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(brag)
      .values({ documentId: docId, ...toFields(parsed.data) })
      .returning({ id: brag.id });
    const values = linkValues(row!.id, parsed.data.links);
    if (values.length > 0) await tx.insert(bragLink).values(values);
    return row!;
  });
  return { ok: true, id: created.id };
}

/**
 * Update a brag the caller owns and replace its links. Ownership is enforced in
 * the UPDATE's WHERE (the correlated EXISTS) — if it matches no row, nothing
 * downstream runs, so we never touch the links of a brag the caller doesn't own.
 * Links are replaced wholesale (delete + re-insert) so positions stay contiguous.
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
    return true;
  });
  if (!ok) return { ok: false, error: "Brag not found." };
  return { ok: true };
}

/** Permanently delete a brag the caller owns (its links and tag associations cascade). */
export async function deleteBrag(bragId: string): Promise<ActionResult> {
  const { workspaceId, user } = await requireWorkspace();
  const deleted = await db
    .delete(brag)
    .where(and(eq(brag.id, bragId), ownedBrag(workspaceId, user.id)))
    .returning({ id: brag.id });
  if (deleted.length === 0) return { ok: false, error: "Brag not found." };
  return { ok: true };
}

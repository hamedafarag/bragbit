"use server";

import { randomBytes } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { requireWorkspace } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { document, shareLink } from "@/lib/db/schema";

import { shareLinkToView, type ShareLinkView } from "./queries";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type ShareResult = { ok: true; link: ShareLinkView } | { ok: false; error: string };

/**
 * The share token — the only credential, so it must be unguessable. 24 random
 * bytes (192 bits, comfortably past the "16+ bytes" floor) as URL-safe base64url,
 * which the public route reads verbatim from the path.
 */
function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Verify the caller owns `documentId` (workspace + user); returns its id, or null. */
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

/** The active (non-revoked) share link for an already-owned document, or null. */
async function activeLinkFor(documentId: string) {
  const [row] = await db
    .select()
    .from(shareLink)
    .where(and(eq(shareLink.documentId, documentId), isNull(shareLink.revokedAt)))
    .limit(1);
  return row ?? null;
}

/**
 * Create a share link for a document the caller owns. Idempotent: if an active
 * link already exists it's returned unchanged, so the dialog's "Create" is
 * race-safe and we keep the one-active-link-per-document invariant. Ownership is
 * resolved before any write — a documentId from another workspace/user 404s.
 */
export async function createShareLink(documentId: string): Promise<ShareResult> {
  const ownedId = await ownedDocumentId(documentId);
  if (!ownedId) return { ok: false, error: "Document not found." };

  const existing = await activeLinkFor(ownedId);
  if (existing) return { ok: true, link: shareLinkToView(existing) };

  const [row] = await db
    .insert(shareLink)
    .values({ documentId: ownedId, token: newToken() })
    .returning();
  return { ok: true, link: shareLinkToView(row!) };
}

/**
 * Revoke the active share link for a document the caller owns (sets `revokedAt`,
 * which makes the public route 404). A no-op if there's no active link.
 */
export async function revokeShareLink(documentId: string): Promise<ActionResult> {
  const ownedId = await ownedDocumentId(documentId);
  if (!ownedId) return { ok: false, error: "Document not found." };

  await db
    .update(shareLink)
    .set({ revokedAt: new Date() })
    .where(and(eq(shareLink.documentId, ownedId), isNull(shareLink.revokedAt)));
  return { ok: true };
}

/**
 * Rotate the share link: revoke any active link and mint a fresh token in one
 * transaction. The old URL stops working immediately; the new one is returned.
 */
export async function rotateShareLink(documentId: string): Promise<ShareResult> {
  const ownedId = await ownedDocumentId(documentId);
  if (!ownedId) return { ok: false, error: "Document not found." };

  const row = await db.transaction(async (tx) => {
    await tx
      .update(shareLink)
      .set({ revokedAt: new Date() })
      .where(and(eq(shareLink.documentId, ownedId), isNull(shareLink.revokedAt)));
    const [created] = await tx
      .insert(shareLink)
      .values({ documentId: ownedId, token: newToken() })
      .returning();
    return created!;
  });
  return { ok: true, link: shareLinkToView(row) };
}

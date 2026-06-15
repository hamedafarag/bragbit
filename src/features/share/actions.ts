"use server";

import { randomBytes } from "node:crypto";

import { hash, verify } from "@node-rs/argon2";
import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";

import { requireWorkspace } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { document, shareLink } from "@/lib/db/schema";
import { hitRateLimit, resetRateLimit } from "@/lib/rate-limit";

import { getShareCredentials, shareLinkToView, type ShareLinkView } from "./queries";
import { sharePasswordSchema } from "./schema";
import { setShareUnlockCookie } from "./unlock";

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

/**
 * Set (or change) the password on a document's active share link — argon2-hashed,
 * never stored in clear. Owner-only; requires an active link. Changing the
 * password re-hashes, which invalidates every outstanding unlock cookie (they're
 * bound to the hash), so prior visitors must re-enter it.
 */
export async function setSharePassword(
  documentId: string,
  password: string,
): Promise<ActionResult> {
  const ownedId = await ownedDocumentId(documentId);
  if (!ownedId) return { ok: false, error: "Document not found." };

  const parsed = sharePasswordSchema.safeParse({ password });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid password." };
  }
  const active = await activeLinkFor(ownedId);
  if (!active) return { ok: false, error: "Create a share link first." };

  const passwordHash = await hash(parsed.data.password);
  await db.update(shareLink).set({ passwordHash }).where(eq(shareLink.id, active.id));
  return { ok: true };
}

/** Remove the password from a document's active share link (owner-only). */
export async function removeSharePassword(documentId: string): Promise<ActionResult> {
  const ownedId = await ownedDocumentId(documentId);
  if (!ownedId) return { ok: false, error: "Document not found." };

  await db
    .update(shareLink)
    .set({ passwordHash: null })
    .where(and(eq(shareLink.documentId, ownedId), isNull(shareLink.revokedAt)));
  return { ok: true };
}

export type UnlockCode = "incorrect" | "rate" | "unavailable";
export type UnlockResult = { ok: true } | { ok: false; code: UnlockCode };

/**
 * Public unlock: verify a visitor's password against a share's argon2 hash and, on
 * success, set the httpOnly per-share unlock cookie. Attempts are rate-limited per
 * share (brute-force protection); a correct password clears the counter. Authorizes
 * by token only — no session. Returns a stable code (not a message) so the page
 * renders fixed copy and nothing attacker-controlled is reflected.
 */
export async function unlockShare(token: string, password: string): Promise<UnlockResult> {
  const cred = await getShareCredentials(token);
  if (!cred || !cred.passwordHash) return { ok: false, code: "unavailable" };

  const limited = hitRateLimit(`share-unlock:${cred.id}`, 5, 10 * 60 * 1000);
  if (!limited.ok) return { ok: false, code: "rate" };

  const valid = await verify(cred.passwordHash, password).catch(() => false);
  if (!valid) return { ok: false, code: "incorrect" };

  resetRateLimit(`share-unlock:${cred.id}`);
  await setShareUnlockCookie(cred.id, cred.passwordHash);
  return { ok: true };
}

/**
 * Form action behind the unlock gate — a bound server action so the gate works as
 * a plain `<form>` with no client JS (progressive enhancement on the public page).
 * Redirects back to the share on success, or with a `?e=<code>` the page maps to
 * fixed copy on failure.
 */
export async function unlockShareForm(token: string, formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  const result = await unlockShare(token, password);
  redirect(result.ok ? `/share/${token}` : `/share/${token}?e=${result.code}`);
}

import "server-only";

import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import type { AttachmentRow } from "@/features/attachment/queries";
import type { BragWithRelations } from "@/features/brag/queries";
import { requireWorkspace } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  attachment,
  brag,
  bragLink,
  bragTag,
  document,
  organization,
  shareLink,
  tag,
} from "@/lib/db/schema";
import { env } from "@/lib/env";

/** The owner-facing view of a document's active share link (the URL is absolute). */
export type ShareLinkView = {
  token: string;
  url: string;
  createdAt: string;
  lastAccessedAt: string | null;
};

/**
 * The absolute public URL for a share token. Built from the configured external
 * URL (the same precedence the branded emails use) so a link handed to a manager
 * resolves from outside the deployment, not from an internal hostname.
 */
export function shareUrlForToken(token: string): string {
  const base = env.BETTER_AUTH_URL ?? env.APP_URL;
  return `${base.replace(/\/$/, "")}/share/${token}`;
}

/** A share-link row → the owner-facing view (absolute URL + ISO timestamps). */
export function shareLinkToView(row: typeof shareLink.$inferSelect): ShareLinkView {
  return {
    token: row.token,
    url: shareUrlForToken(row.token),
    createdAt: row.createdAt.toISOString(),
    lastAccessedAt: row.lastAccessedAt?.toISOString() ?? null,
  };
}

/**
 * The active (non-revoked) share link for a document the caller owns, or null.
 * Scoped through the parent document (workspace + owner) via the join, so a
 * documentId from another workspace or user yields nothing — owner-side only.
 * There is at most one active link per document (the create/rotate actions
 * enforce it), but we order newest-first for safety.
 */
export async function getActiveShareLink(documentId: string): Promise<ShareLinkView | null> {
  const { workspaceId, user } = await requireWorkspace();
  const [row] = await db
    .select()
    .from(shareLink)
    .innerJoin(document, eq(document.id, shareLink.documentId))
    .where(
      and(
        eq(shareLink.documentId, documentId),
        isNull(shareLink.revokedAt),
        eq(document.workspaceId, workspaceId),
        eq(document.userId, user.id),
      ),
    )
    .orderBy(desc(shareLink.createdAt))
    .limit(1);
  return row ? shareLinkToView(row.share_links) : null;
}

// ── Public, token-authorized reads ───────────────────────────────────────────
// The deliberate DAL exception (PLAN.md §6): these authorize by the share token,
// not a session. They scope strictly to the token's document and filter
// `visibility = 'shared'` at the query layer, so a private brag — or anything in
// another document — can never reach a public share. No requireWorkspace here.

/** The workspace brand + document fields shown on a public share page. */
export type SharedDocument = {
  token: string;
  document: {
    id: string;
    title: string;
    description: string | null;
    periodStart: string | null;
    periodEnd: string | null;
    goalsMd: string | null;
  };
  brand: { name: string; accentColor: string | null; logoKey: string | null };
  brags: BragWithRelations[];
};

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
 * The document behind a valid (non-revoked) share token, its workspace brand, and
 * its SHARED brags only (newest first, with links/attachments/tags batch-loaded —
 * no N+1, mirroring listBrags). Returns null if the token is unknown or revoked,
 * which the page turns into a 404. Bumps `last_accessed_at` as a side effect so
 * the owner can see when the link was last opened (PLAN §6); a best-effort write,
 * never blocking the read.
 */
export async function getSharedDocument(token: string): Promise<SharedDocument | null> {
  const [head] = await db
    .select({
      shareId: shareLink.id,
      docId: document.id,
      title: document.title,
      description: document.description,
      periodStart: document.periodStart,
      periodEnd: document.periodEnd,
      goalsMd: document.goalsMd,
      brandName: organization.name,
      accentColor: organization.accentColor,
      logoKey: organization.logoKey,
    })
    .from(shareLink)
    .innerJoin(document, eq(document.id, shareLink.documentId))
    .innerJoin(organization, eq(organization.id, document.workspaceId))
    .where(and(eq(shareLink.token, token), isNull(shareLink.revokedAt)))
    .limit(1);
  if (!head) return null;

  const sharedBrags = await db
    .select()
    .from(brag)
    .where(and(eq(brag.documentId, head.docId), eq(brag.visibility, "shared")))
    .orderBy(desc(brag.date), desc(brag.createdAt));

  const ids = sharedBrags.map((b) => b.id);
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
    brags = sharedBrags.map((b) => ({
      ...b,
      links: linksByBrag.get(b.id) ?? [],
      attachments: attachmentsByBrag.get(b.id) ?? [],
      tags: (tagsByBrag.get(b.id) ?? []).map((t) => t.name),
    }));
  }

  // Record the visit; a failure here must not break the page.
  await db
    .update(shareLink)
    .set({ lastAccessedAt: new Date() })
    .where(eq(shareLink.id, head.shareId))
    .catch(() => {});

  return {
    token,
    document: {
      id: head.docId,
      title: head.title,
      description: head.description,
      periodStart: head.periodStart,
      periodEnd: head.periodEnd,
      goalsMd: head.goalsMd,
    },
    brand: { name: head.brandName, accentColor: head.accentColor, logoKey: head.logoKey },
    brags,
  };
}

/**
 * The attachment at `storageKey`, authorized by a share token rather than a
 * session: its brag must be SHARED and belong to the token's (non-revoked)
 * document. Backs the public path on the file-stream route. Returns null
 * otherwise — a private brag's attachment is never reachable via a share.
 */
export async function getSharedAttachmentByKey(
  storageKey: string,
  token: string,
): Promise<AttachmentRow | null> {
  const [row] = await db
    .select()
    .from(attachment)
    .innerJoin(brag, eq(brag.id, attachment.bragId))
    .innerJoin(document, eq(document.id, brag.documentId))
    .innerJoin(shareLink, eq(shareLink.documentId, document.id))
    .where(
      and(
        eq(attachment.storageKey, storageKey),
        eq(brag.visibility, "shared"),
        eq(shareLink.token, token),
        isNull(shareLink.revokedAt),
      ),
    )
    .limit(1);
  return row ? row.attachments : null;
}

import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { requireWorkspace } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { document, shareLink } from "@/lib/db/schema";
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

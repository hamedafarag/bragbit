import "server-only";

import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";

import { requireWorkspace } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { document } from "@/lib/db/schema";

export type DocumentRow = typeof document.$inferSelect;

/**
 * The caller's active (non-archived) documents in their active workspace, newest
 * first. Runs the DAL guard internally (like listMembers) and scopes to the
 * caller's user id as well as the workspace — documents are private per user, so
 * an admin role doesn't widen this.
 */
export async function listDocuments(): Promise<DocumentRow[]> {
  const { workspaceId, user } = await requireWorkspace();
  return db
    .select()
    .from(document)
    .where(
      and(
        eq(document.workspaceId, workspaceId),
        eq(document.userId, user.id),
        isNull(document.archivedAt),
      ),
    )
    .orderBy(desc(document.createdAt));
}

/** The caller's archived documents in their active workspace, most recently archived first. */
export async function listArchivedDocuments(): Promise<DocumentRow[]> {
  const { workspaceId, user } = await requireWorkspace();
  return db
    .select()
    .from(document)
    .where(
      and(
        eq(document.workspaceId, workspaceId),
        eq(document.userId, user.id),
        isNotNull(document.archivedAt),
      ),
    )
    .orderBy(desc(document.archivedAt));
}

/** A single document the caller owns in their active workspace, or null. */
export async function getDocument(documentId: string): Promise<DocumentRow | null> {
  const { workspaceId, user } = await requireWorkspace();
  const [row] = await db
    .select()
    .from(document)
    .where(
      and(
        eq(document.id, documentId),
        eq(document.workspaceId, workspaceId),
        eq(document.userId, user.id),
      ),
    )
    .limit(1);
  return row ?? null;
}

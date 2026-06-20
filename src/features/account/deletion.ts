import "server-only";

import { and, eq, inArray, ne, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { attachment, brag, document, member, organization, profile } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";

/**
 * Storage cleanup for account deletion, run from the `deleteUser` beforeDelete
 * hook BEFORE Better Auth's row cascade fires. The cascade (user → sessions /
 * accounts / members / profile, and organization → its documents → brags →
 * attachments) removes the DB rows but never the stored OBJECTS, so — mirroring
 * `deleteDocument`'s object purge — we collect and delete them here:
 *
 *   - the user's avatar,
 *   - every attachment the deletion will orphan: those on the user's own
 *     documents (across all workspaces, since a document FK to the user cascades)
 *     PLUS every attachment in a workspace being dropped (a sole-member org can
 *     still hold a removed member's documents, which the org-drop cascades away).
 *
 * It also drops each workspace the user is the sole member of — the user cascade
 * doesn't reach the organization row. Every storage delete is best-effort: a
 * missing or concurrently-removed object must never abort the account deletion.
 */
export async function cleanupUserStorage(deletingUserId: string): Promise<void> {
  const storage = getStorage();

  // 1. Avatar object.
  const [p] = await db
    .select({ avatarKey: profile.avatarKey })
    .from(profile)
    .where(eq(profile.userId, deletingUserId))
    .limit(1);
  if (p?.avatarKey) await storage.delete(p.avatarKey).catch(() => {});

  // 2. Workspaces the user is the sole member of — dropped below (no cascade
  //    reaches the organization row from the user).
  const memberships = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, deletingUserId));
  const droppedWorkspaceIds: string[] = [];
  for (const { organizationId } of memberships) {
    const [other] = await db
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.organizationId, organizationId), ne(member.userId, deletingUserId)))
      .limit(1);
    if (!other) droppedWorkspaceIds.push(organizationId);
  }

  // 3. Attachment objects the deletion will orphan — collected BEFORE any row is
  //    removed (afterwards the join would find nothing).
  const ownerScope = eq(document.userId, deletingUserId);
  const rows = await db
    .select({ storageKey: attachment.storageKey })
    .from(attachment)
    .innerJoin(brag, eq(brag.id, attachment.bragId))
    .innerJoin(document, eq(document.id, brag.documentId))
    .where(
      droppedWorkspaceIds.length
        ? or(ownerScope, inArray(document.workspaceId, droppedWorkspaceIds))
        : ownerScope,
    );
  const attachmentKeys = [...new Set(rows.map((r) => r.storageKey))];

  // 4. Drop the sole-member workspaces (cascades their documents → brags → rows).
  if (droppedWorkspaceIds.length)
    await db.delete(organization).where(inArray(organization.id, droppedWorkspaceIds));

  // 5. Purge the orphaned attachment objects (best-effort, like the avatar).
  await Promise.all(attachmentKeys.map((key) => storage.delete(key).catch(() => {})));
}

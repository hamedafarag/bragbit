import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { attachment, brag, document, organization } from "@/lib/db/schema";
import { env } from "@/lib/env";

/** Bytes of attachment storage a workspace currently uses (across all its docs + brags). */
export async function workspaceStorageBytes(workspaceId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${attachment.sizeBytes}), 0)` })
    .from(attachment)
    .innerJoin(brag, eq(brag.id, attachment.bragId))
    .innerJoin(document, eq(document.id, brag.documentId))
    .where(eq(document.workspaceId, workspaceId));
  return Number(row?.total ?? 0);
}

/**
 * A workspace's effective storage quota in bytes — its per-workspace override (set in
 * the /super console) if present, else the instance-wide `WORKSPACE_QUOTA_MB` default.
 */
export async function workspaceQuotaBytes(workspaceId: string): Promise<number> {
  const [row] = await db
    .select({ quota: organization.storageQuotaMb })
    .from(organization)
    .where(eq(organization.id, workspaceId))
    .limit(1);
  const mb = row?.quota ?? env.WORKSPACE_QUOTA_MB;
  return mb * 1024 * 1024;
}

/** Whether adding `incomingBytes` would push the workspace over its storage quota. */
export async function exceedsStorageQuota(
  workspaceId: string,
  incomingBytes: number,
): Promise<boolean> {
  const [used, limit] = await Promise.all([
    workspaceStorageBytes(workspaceId),
    workspaceQuotaBytes(workspaceId),
  ]);
  return used + incomingBytes > limit;
}

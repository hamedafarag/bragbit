"use server";

import { eq } from "drizzle-orm";

import { requireSuperadmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { organization, user } from "@/lib/db/schema";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Suspend or unsuspend a workspace (superadmin, PLAN §10). A suspended workspace
 * freezes its members out of the app (enforced in the (app) gate). Stamps/clears
 * `suspendedAt`; never touches the workspace's content.
 */
export async function setWorkspaceSuspended(
  orgId: string,
  suspended: boolean,
): Promise<ActionResult> {
  await requireSuperadmin();
  await db
    .update(organization)
    .set({ suspendedAt: suspended ? new Date() : null })
    .where(eq(organization.id, orgId));
  return { ok: true };
}

/**
 * Suspend or unsuspend an account (superadmin). A suspended account is frozen out of
 * every workspace it belongs to (enforced in the (app) gate).
 */
export async function setUserSuspended(userId: string, suspended: boolean): Promise<ActionResult> {
  await requireSuperadmin();
  await db
    .update(user)
    .set({ suspendedAt: suspended ? new Date() : null })
    .where(eq(user.id, userId));
  return { ok: true };
}

/**
 * Set (or clear) a workspace's storage-quota override in MB; `null` restores the
 * instance-wide `WORKSPACE_QUOTA_MB` default. Superadmin-only. (Enforcement of the
 * quota on uploads lands with the abuse-controls slice.)
 */
export async function setWorkspaceQuota(
  orgId: string,
  quotaMb: number | null,
): Promise<ActionResult> {
  await requireSuperadmin();
  if (quotaMb !== null && (!Number.isInteger(quotaMb) || quotaMb <= 0)) {
    return { ok: false, error: "Quota must be a positive whole number of MB." };
  }
  await db.update(organization).set({ storageQuotaMb: quotaMb }).where(eq(organization.id, orgId));
  return { ok: true };
}

import "server-only";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { requireWorkspace } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { organization } from "@/lib/db/schema";
import { isHosted } from "@/lib/instance";

export type Workspace = typeof organization.$inferSelect;

export type WorkspaceBrand = {
  name: string;
  accentColor: string | null;
  logoKey: string | null;
};

/** The caller, their active workspace, and their role in it (membership pre-verified). */
export async function getActiveWorkspace() {
  const { user, workspaceId, member } = await requireWorkspace();
  const [workspace] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, workspaceId))
    .limit(1);
  // requireWorkspace proved membership (FK-backed), so the row exists; guard anyway.
  if (!workspace) redirect("/");
  return { user, workspace, role: member.role };
}

/**
 * Branding for the pre-auth surfaces (the login pages). The private modes have
 * exactly one workspace, so its brand reads as instance-wide. On a hosted
 * instance there are many workspaces and no active one before sign-in, so login
 * uses the BragBit default (null) and per-workspace branding applies post-auth.
 */
export async function getInstanceBranding(): Promise<WorkspaceBrand | null> {
  if (isHosted()) return null;
  const [row] = await db
    .select({
      name: organization.name,
      accentColor: organization.accentColor,
      logoKey: organization.logoKey,
    })
    .from(organization)
    .limit(1);
  return row ?? null;
}

import "server-only";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { requireWorkspace } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { organization } from "@/lib/db/schema";

export type Workspace = typeof organization.$inferSelect;

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

import "server-only";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { member } from "@/lib/db/schema";

export type WorkspaceRole = "owner" | "admin" | "member";

/**
 * The DAL gate (PLAN.md §6). Every workspace-scoped read/write must pass through
 * one of these guards, which verify the session AND workspace membership.
 * Nothing outside this module should query membership directly.
 */

/** Require an authenticated user; redirect to sign-in otherwise. */
export async function requireSession() {
  const data = await auth.api.getSession({ headers: await headers() });
  if (!data) redirect("/sign-in");
  return data;
}

/** Require an active workspace the caller is a member of; returns the membership. */
export async function requireWorkspace() {
  const { user, session } = await requireSession();
  const workspaceId = session.activeOrganizationId;
  if (!workspaceId) redirect("/");

  const [membership] = await db
    .select()
    .from(member)
    .where(and(eq(member.organizationId, workspaceId), eq(member.userId, user.id)))
    .limit(1);

  // Not a member of the active workspace → no access (cross-workspace = 404-equivalent).
  if (!membership) redirect("/");

  return { user, session, workspaceId, member: membership };
}

/** Require the caller's active-workspace membership to hold one of `roles`. */
export async function requireRole(...roles: WorkspaceRole[]) {
  const ctx = await requireWorkspace();
  if (!roles.includes(ctx.member.role as WorkspaceRole)) redirect("/");
  return ctx;
}

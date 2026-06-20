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
 *
 * Two flavors: the `require*` guards `redirect()` and are for Server Components /
 * Server Actions; the `*OrNull` / `is*` helpers return null/false and are for
 * Route Handlers, which answer with an HTTP status rather than a redirect.
 */

/** The caller's membership in `workspaceId`, or null. */
async function lookupMembership(userId: string, workspaceId: string) {
  const [membership] = await db
    .select()
    .from(member)
    .where(and(eq(member.organizationId, workspaceId), eq(member.userId, userId)))
    .limit(1);
  return membership ?? null;
}

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
  // Authenticated but no accessible workspace (e.g. a removed member with a live
  // session) → a terminal page, NOT `/`. Bouncing to `/` would loop, because the
  // root dispatcher sends a signed-in caller straight back to `/dashboard`
  // (ENH-CQ-07). `/no-workspace` is the exit and never redirects such a caller on.
  if (!workspaceId) redirect("/no-workspace");

  const membership = await lookupMembership(user.id, workspaceId);
  // Not a member of the active workspace → no access (cross-workspace = 404-equivalent).
  if (!membership) redirect("/no-workspace");

  return { user, session, workspaceId, member: membership };
}

/** Require the caller's active-workspace membership to hold one of `roles`. */
export async function requireRole(...roles: WorkspaceRole[]) {
  const ctx = await requireWorkspace();
  // Insufficient role → the dashboard directly. The caller is signed in with a
  // workspace, so "/" would just re-dispatch them here (ENH-CQ-06; cf. the
  // /no-workspace note in requireWorkspace).
  if (!roles.includes(ctx.member.role as WorkspaceRole)) redirect("/dashboard");
  return ctx;
}

/** Route-handler variant of `requireSession`: the session data, or null. */
export async function getSessionOrNull() {
  return auth.api.getSession({ headers: await headers() });
}

/** Route-handler variant of `requireWorkspace`: the active-workspace context, or null. */
export async function getWorkspaceOrNull() {
  const data = await getSessionOrNull();
  if (!data) return null;
  const workspaceId = data.session.activeOrganizationId;
  if (!workspaceId) return null;
  const membership = await lookupMembership(data.user.id, workspaceId);
  if (!membership) return null;
  return { user: data.user, session: data.session, workspaceId, member: membership };
}

/** Whether `userId` is a member of `workspaceId` (the file-serving guard). */
export async function isWorkspaceMember(userId: string, workspaceId: string) {
  return (await lookupMembership(userId, workspaceId)) !== null;
}

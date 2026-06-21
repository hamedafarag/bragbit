import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { isAcceptableInvitation } from "@/features/invitation/validity";
import { requireRole, requireWorkspace } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { invitation, member, organization, session, user } from "@/lib/db/schema";
import { isHosted } from "@/lib/instance";

import type { UserWorkspace } from "./components/workspace-switcher";

export type Workspace = typeof organization.$inferSelect;

export type WorkspaceBrand = {
  name: string;
  accentColor: string | null;
  logoKey: string | null;
};

export type MemberRow = {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: Date;
  lastActiveAt: Date | null;
};

export type PendingInvitationRow = {
  id: string;
  email: string;
  role: string;
  expiresAt: Date;
};

/** The caller, their active workspace, and their role in it (membership pre-verified). */
export async function getActiveWorkspace() {
  const { user: caller, workspaceId, member: membership } = await requireWorkspace();
  const [workspace] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, workspaceId))
    .limit(1);
  // requireWorkspace proved membership (FK-backed), so the row exists; guard anyway.
  if (!workspace) redirect("/");
  return { user: caller, workspace, role: membership.role };
}

/**
 * Every workspace the caller belongs to (their personal one + any orgs), each with
 * their role and whether it's the active one — the data behind the header workspace
 * switcher (PLAN §10). Ordered personal-first, then by name.
 */
export async function listUserWorkspaces(): Promise<UserWorkspace[]> {
  const { user: caller, workspaceId } = await requireWorkspace();
  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      type: organization.type,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(member.userId, caller.id))
    .orderBy(sql`${organization.type} <> 'personal'`, organization.name);
  return rows.map((r) => ({ ...r, isActive: r.id === workspaceId }));
}

/**
 * Branding for the pre-auth surfaces (the login pages). The private modes have
 * exactly one workspace, so its brand reads as instance-wide. On a hosted
 * instance there are many workspaces and no active one before sign-in, so login
 * uses the BragBit default (null) and per-workspace branding applies post-auth.
 */
export async function getInstanceBranding(): Promise<WorkspaceBrand | null> {
  if (isHosted()) return null;
  // Live per-instance branding — defer out of prerendering (like isInstanceSetup)
  // so the production image builds with no database reachable.
  await connection();
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

/** Members of the active workspace with role, join date, and last activity (owner/admin only). */
export async function listMembers(): Promise<MemberRow[]> {
  const { workspaceId } = await requireRole("owner", "admin");

  const rows = await db
    .select({
      memberId: member.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      role: member.role,
      joinedAt: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, workspaceId))
    .orderBy(member.createdAt);

  if (rows.length === 0) return [];

  // Last activity = the most recent session per member's user.
  const activity = await db
    .select({
      userId: session.userId,
      lastActiveAt: sql<Date>`max(${session.updatedAt})`,
    })
    .from(session)
    .where(
      inArray(
        session.userId,
        rows.map((r) => r.userId),
      ),
    )
    .groupBy(session.userId);
  const lastActive = new Map(activity.map((a) => [a.userId, a.lastActiveAt]));

  return rows.map((r) => ({ ...r, lastActiveAt: lastActive.get(r.userId) ?? null }));
}

/** Still-valid (pending, unexpired) invitations for the active workspace (owner/admin only). */
export async function listPendingInvitations(): Promise<PendingInvitationRow[]> {
  const { workspaceId } = await requireRole("owner", "admin");

  const rows = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    })
    .from(invitation)
    .where(and(eq(invitation.organizationId, workspaceId), eq(invitation.status, "pending")))
    .orderBy(desc(invitation.createdAt));

  return rows
    .filter((r) => isAcceptableInvitation({ status: r.status, expiresAt: r.expiresAt }))
    .map((r) => ({ id: r.id, email: r.email, role: r.role ?? "member", expiresAt: r.expiresAt }));
}

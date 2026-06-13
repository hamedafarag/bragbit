"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { requireRole } from "@/lib/auth/guards";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { invitation, member, organization } from "@/lib/db/schema";

import {
  brandingSchema,
  inviteSchema,
  roleSchema,
  type BrandingInput,
  type InviteInput,
} from "./schema";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type InviteResult =
  | { ok: true; invited: number; failures: { email: string; error: string }[] }
  | { ok: false; error: string };

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * Update the active workspace's branding (name + accent). Owner/admin only — the
 * role gate runs in the DAL. The logo is set by its own upload route. The client
 * refreshes after this returns so the chrome re-renders with the new brand.
 */
export async function updateWorkspaceBranding(input: BrandingInput): Promise<ActionResult> {
  const { workspaceId } = await requireRole("owner", "admin");

  const parsed = brandingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await db
    .update(organization)
    .set({ name: parsed.data.name, accentColor: parsed.data.accentColor })
    .where(eq(organization.id, workspaceId));

  return { ok: true };
}

/**
 * Invite one or more people to the active workspace. Better Auth generates the
 * token, sends the branded email, and (via cancelPendingInvitationsOnReInvite)
 * revokes a prior pending invite for the same address. Per-email failures (e.g.
 * already a member) are reported individually rather than failing the batch.
 */
export async function inviteMembers(input: InviteInput): Promise<InviteResult> {
  await requireRole("owner", "admin");

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const reqHeaders = await headers();
  const failures: { email: string; error: string }[] = [];
  for (const email of parsed.data.emails) {
    try {
      await auth.api.createInvitation({
        body: { email, role: parsed.data.role },
        headers: reqHeaders,
      });
    } catch (err) {
      failures.push({ email, error: errorMessage(err, "could not invite") });
    }
  }

  return { ok: true, invited: parsed.data.emails.length - failures.length, failures };
}

/** Revoke a pending invitation (owner/admin). Better Auth scopes this to the caller's org. */
export async function revokeInvitation(invitationId: string): Promise<ActionResult> {
  await requireRole("owner", "admin");
  try {
    await auth.api.cancelInvitation({ body: { invitationId }, headers: await headers() });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Could not revoke the invitation.") };
  }
}

/**
 * Re-send a pending invitation: look up its email + role within the active
 * workspace (never trust a client-supplied address), then re-issue with resend.
 */
export async function resendInvitation(invitationId: string): Promise<ActionResult> {
  const { workspaceId } = await requireRole("owner", "admin");

  const [inv] = await db
    .select({
      email: invitation.email,
      role: invitation.role,
      organizationId: invitation.organizationId,
    })
    .from(invitation)
    .where(eq(invitation.id, invitationId))
    .limit(1);
  if (!inv || inv.organizationId !== workspaceId) {
    return { ok: false, error: "Invitation not found." };
  }

  // The stored role is a free-form string column; narrow it back to a valid role.
  const parsedRole = roleSchema.safeParse(inv.role);
  const role = parsedRole.success ? parsedRole.data : "member";

  try {
    await auth.api.createInvitation({
      body: { email: inv.email, role, resend: true },
      headers: await headers(),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Could not resend the invitation.") };
  }
}

/**
 * Change a member's role. Better Auth enforces owner protection — admins cannot
 * demote/remove the owner or promote anyone to owner; only the owner can.
 */
export async function changeMemberRole(memberId: string, role: string): Promise<ActionResult> {
  await requireRole("owner", "admin");

  const parsedRole = roleSchema.safeParse(role);
  if (!parsedRole.success) return { ok: false, error: "Invalid role." };

  try {
    await auth.api.updateMemberRole({
      body: { memberId, role: parsedRole.data },
      headers: await headers(),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Could not change the role.") };
  }
}

/**
 * Remove a member from the active workspace. The owner can't be removed and you
 * can't remove yourself; Better Auth re-checks permissions. This purges the
 * membership — the complete workspace removal for now. The export-then-delete
 * bundle and full account offboard join when export ships (Phase 7); there's no
 * brag data to export until Phase 3.
 */
export async function removeMember(memberId: string): Promise<ActionResult> {
  const { workspaceId, user } = await requireRole("owner", "admin");

  const [target] = await db
    .select({
      userId: member.userId,
      role: member.role,
      organizationId: member.organizationId,
    })
    .from(member)
    .where(eq(member.id, memberId))
    .limit(1);
  if (!target || target.organizationId !== workspaceId) {
    return { ok: false, error: "Member not found." };
  }
  if (target.userId === user.id) return { ok: false, error: "You can't remove yourself." };
  if (target.role === "owner") return { ok: false, error: "The owner can't be removed." };

  try {
    await auth.api.removeMember({ body: { memberIdOrEmail: memberId }, headers: await headers() });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Could not remove the member.") };
  }
}

/**
 * Transfer ownership to another member (owner only). Atomic so the workspace
 * always has exactly one owner (PLAN §5): the target becomes owner and the
 * current owner steps down to admin in a single transaction.
 */
export async function transferOwnership(memberId: string): Promise<ActionResult> {
  const { workspaceId, user } = await requireRole("owner");

  const [target] = await db
    .select({
      userId: member.userId,
      organizationId: member.organizationId,
    })
    .from(member)
    .where(eq(member.id, memberId))
    .limit(1);
  if (!target || target.organizationId !== workspaceId) {
    return { ok: false, error: "Member not found." };
  }
  if (target.userId === user.id) return { ok: false, error: "You're already the owner." };

  await db.transaction(async (tx) => {
    await tx.update(member).set({ role: "owner" }).where(eq(member.id, memberId));
    await tx
      .update(member)
      .set({ role: "admin" })
      .where(and(eq(member.organizationId, workspaceId), eq(member.userId, user.id)));
  });
  return { ok: true };
}

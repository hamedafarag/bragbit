"use server";

import { randomBytes } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { requireRole, requireSession } from "@/lib/auth/guards";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { invitation, member, organization, user as userTable } from "@/lib/db/schema";
import { allowsOrgCreation } from "@/lib/instance";

import { emailRemovedMemberBundle } from "./offboard";
import {
  brandingSchema,
  createOrgSchema,
  inviteSchema,
  roleSchema,
  type BrandingInput,
  type CreateOrgInput,
  type InviteInput,
} from "./schema";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type InviteResult =
  | { ok: true; invited: number; failures: { email: string; error: string }[] }
  | { ok: false; error: string };

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export type CreateOrgResult = { ok: true; id: string } | { ok: false; error: string };

/** Slugify a workspace name into a URL-safe base. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A globally-unique org slug from the name. `organization.slug` is unique; if the
 * slugified base is already taken we append a short random suffix. The unique index
 * is the real guard — a create/create race still surfaces as the friendly error in
 * `createOrganizationWorkspace`.
 */
async function uniqueOrgSlug(name: string): Promise<string> {
  const base = slugify(name) || "workspace";
  const [taken] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, base))
    .limit(1);
  return taken ? `${base}-${randomBytes(3).toString("hex")}` : base;
}

/**
 * Create an organization workspace owned by the caller (PLAN §10). Hosted only —
 * any signed-in user may create one, becomes its owner, and is switched into it.
 * Reuses Better Auth's `createOrganization` (the session makes the caller the
 * owner) and then sets it active so they land in the new workspace. The private
 * modes have a fixed single workspace, so this is gated by `allowsOrgCreation()`.
 */
export async function createOrganizationWorkspace(input: CreateOrgInput): Promise<CreateOrgResult> {
  await requireSession();
  if (!allowsOrgCreation()) {
    return { ok: false, error: "Creating organizations isn't available on this instance." };
  }

  const parsed = createOrgSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const reqHeaders = await headers();
  try {
    const org = await auth.api.createOrganization({
      body: {
        name: parsed.data.name,
        slug: await uniqueOrgSlug(parsed.data.name),
        type: "organization",
        ...(parsed.data.accentColor ? { accentColor: parsed.data.accentColor } : {}),
      },
      headers: reqHeaders,
    });
    if (!org?.id) return { ok: false, error: "Couldn't create the organization. Try again." };

    await auth.api.setActiveOrganization({
      body: { organizationId: org.id },
      headers: reqHeaders,
    });
    return { ok: true, id: org.id };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Couldn't create the organization. Try again.") };
  }
}

/**
 * Switch the caller's active workspace (PLAN §10 — the header switcher). Verifies
 * membership first (you can only switch into a workspace you belong to), then sets
 * it active via Better Auth; the client refreshes, re-scoping/re-theming the app.
 */
export async function switchWorkspace(organizationId: string): Promise<ActionResult> {
  const { user } = await requireSession();

  const [m] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, user.id)))
    .limit(1);
  if (!m) return { ok: false, error: "Workspace not found." };

  try {
    await auth.api.setActiveOrganization({ body: { organizationId }, headers: await headers() });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Couldn't switch workspace.") };
  }
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
 * membership, then emails the member a copy of all their data (ENH-CO-01) so it
 * stays theirs. The member's documents/brags are left in place for now — a full
 * account offboard (purging the orphaned data) is still future work.
 */
export async function removeMember(memberId: string): Promise<ActionResult> {
  const { workspaceId, user } = await requireRole("owner", "admin");

  const [target] = await db
    .select({
      userId: member.userId,
      email: userTable.email,
      role: member.role,
      organizationId: member.organizationId,
    })
    .from(member)
    .innerJoin(userTable, eq(userTable.id, member.userId))
    .where(eq(member.id, memberId))
    .limit(1);
  if (!target || target.organizationId !== workspaceId) {
    return { ok: false, error: "Member not found." };
  }
  if (target.userId === user.id) return { ok: false, error: "You can't remove yourself." };
  if (target.role === "owner") return { ok: false, error: "The owner can't be removed." };

  try {
    await auth.api.removeMember({ body: { memberIdOrEmail: memberId }, headers: await headers() });
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Could not remove the member.") };
  }

  // Removal succeeded — hand the member a copy of their data so it stays theirs
  // (ENH-CO-01). Best-effort: a mail failure must never undo the removal, and the
  // data still persists for a manual export. Runs after the purge; the member's
  // documents/brags remain until a separate offboard, so the bundle is complete.
  try {
    await emailRemovedMemberBundle({ workspaceId, userId: target.userId, email: target.email });
  } catch {
    // Swallowed on purpose — see above.
  }
  return { ok: true };
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

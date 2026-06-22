import "server-only";

import { db } from "@/lib/db";
import { member, organization } from "@/lib/db/schema";
import { isHosted } from "@/lib/instance";

/** A new account's personal-workspace name — "{first name}'s Logbook", or a fallback. */
export function personalWorkspaceName(userName: string | null | undefined): string {
  const first = (userName ?? "").trim().split(/\s+/)[0] ?? "";
  return first ? `${first}'s Logbook` : "Personal Logbook";
}

/**
 * Provision a personal workspace: an `organization` of type `personal` plus the
 * user's `owner` membership — the same org + owner shape the demo/e2e seeds create.
 * Deliberately direct Drizzle inserts (NOT `auth.api.createOrganization`), so this
 * carries no circular dependency on `@/lib/auth` and runs no nested transaction
 * inside the user-create hook that calls it. The slug is globally unique (derived
 * from the generated org id — `organization.slug` is unique-constrained). Branding
 * (accent/logo) is left null so a personal workspace renders the instance default
 * (PLAN §3). Both ids are app-generated — Better Auth's org/member tables have no
 * DB id default. Returns the new workspace id.
 */
export async function provisionPersonalWorkspace(user: {
  id: string;
  name?: string | null;
}): Promise<string> {
  const orgId = crypto.randomUUID();
  await db.insert(organization).values({
    id: orgId,
    name: personalWorkspaceName(user.name),
    slug: `personal-${orgId}`,
    type: "personal",
  });
  await db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId: orgId,
    userId: user.id,
    role: "owner",
  });
  return orgId;
}

/**
 * Better Auth `user.create.after` hook (wired in `@/lib/auth`): on the HOSTED
 * instance, every newly-created account — open email/password signup, OAuth signup,
 * or an invitation-accept — gets its own personal workspace (PLAN §10; a user may
 * belong to both a personal workspace and orgs, §3). An invited user still lands in
 * the org they accept, because `acceptInvitation` sets the active org afterward.
 * No-op in the private modes, where the setup wizard / invitation flow provision
 * membership explicitly — keeping the gate here (not in `@/lib/auth`) so it stays
 * unit-tested in the `src/features` coverage glob.
 */
export async function provisionPersonalWorkspaceOnSignUp(user: {
  id: string;
  name?: string | null;
}): Promise<void> {
  if (!isHosted()) return;
  await provisionPersonalWorkspace(user);
}

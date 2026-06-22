import "server-only";

import { count, desc, eq } from "drizzle-orm";

import { requireSuperadmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { member, organization, user } from "@/lib/db/schema";

export type SuperWorkspaceRow = {
  id: string;
  name: string;
  type: string;
  memberCount: number;
  suspendedAt: Date | null;
  storageQuotaMb: number | null;
  createdAt: Date;
};

export type SuperUserRow = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
  suspendedAt: Date | null;
};

/**
 * Every workspace on the instance with operational metadata ONLY — name, type,
 * member count, suspension, quota, age. Never documents/brags/attachments: the
 * superadmin manages workspaces, never reads their content (PLAN §10, the
 * security-critical constraint). Superadmin-gated.
 */
export async function listWorkspacesForSuper(): Promise<SuperWorkspaceRow[]> {
  await requireSuperadmin();
  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      type: organization.type,
      suspendedAt: organization.suspendedAt,
      storageQuotaMb: organization.storageQuotaMb,
      createdAt: organization.createdAt,
      memberCount: count(member.id),
    })
    .from(organization)
    .leftJoin(member, eq(member.organizationId, organization.id))
    .groupBy(organization.id)
    .orderBy(desc(organization.createdAt));
  return rows.map((r) => ({ ...r, memberCount: Number(r.memberCount) }));
}

/**
 * Every account on the instance — email, verification, signup date, suspension. This
 * is the "view signups" surface (newest-first). Metadata only; no brag content.
 * Superadmin-gated.
 */
export async function listUsersForSuper(): Promise<SuperUserRow[]> {
  await requireSuperadmin();
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      suspendedAt: user.suspendedAt,
    })
    .from(user)
    .orderBy(desc(user.createdAt));
}

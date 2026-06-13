import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { invitation, organization } from "@/lib/db/schema";

import { isAcceptableInvitation } from "./validity";

export type PendingInvitation = {
  id: string;
  email: string;
  role: string;
  organizationName: string;
};

/**
 * Read a still-valid invitation by id for the (logged-out) accept page. Better
 * Auth's getInvitation endpoint requires a matching session the new invitee
 * doesn't have yet, so we read it from the DB directly.
 */
export async function getPendingInvitation(id: string): Promise<PendingInvitation | null> {
  const [row] = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      organizationName: organization.name,
    })
    .from(invitation)
    .innerJoin(organization, eq(organization.id, invitation.organizationId))
    .where(eq(invitation.id, id))
    .limit(1);

  if (!row || !isAcceptableInvitation({ status: row.status, expiresAt: row.expiresAt })) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    role: row.role ?? "member",
    organizationName: row.organizationName,
  };
}

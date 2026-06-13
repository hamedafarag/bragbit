/**
 * Pure workspace-role policy (no `db` / guard imports, so it is unit-testable in
 * isolation). The admin layout and the members UI decide what to show from these;
 * the DAL guards and Better Auth re-enforce them server-side. Owner protection is
 * the load-bearing rule: an admin can never demote, remove, or be handed past the
 * owner, and only the owner can transfer ownership.
 */

export type WorkspaceRole = "owner" | "admin" | "member";

/** Owners and admins can open the admin area and manage the workspace. */
export function canAdminister(role: string): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Whether `actorRole` may manage `targetRole` — change their role or remove them.
 * An administering actor may manage any non-owner that isn't themselves; the
 * owner is never managed through these controls, and you don't manage yourself
 * here (leaving is a separate flow).
 */
export function canManageMember(actorRole: string, targetRole: string, isSelf: boolean): boolean {
  return canAdminister(actorRole) && targetRole !== "owner" && !isSelf;
}

/** Only the owner may hand ownership to another (non-owner) member. */
export function canTransferOwnershipTo(
  actorRole: string,
  targetRole: string,
  isSelf: boolean,
): boolean {
  return actorRole === "owner" && targetRole !== "owner" && !isSelf;
}

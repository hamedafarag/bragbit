/**
 * Pure invitation-acceptability predicate (no `db` import, so it is unit-tested
 * in isolation). An invitation may be accepted only while it is still `pending`
 * and has not expired — this is what makes invitations single-use (reuse flips
 * the status away from `pending`) and time-boxed (7-day expiry, PLAN.md §5).
 */
export function isAcceptableInvitation(
  invite: { status: string; expiresAt: Date },
  now: Date = new Date(),
): boolean {
  return invite.status === "pending" && invite.expiresAt.getTime() > now.getTime();
}

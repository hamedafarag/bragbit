/**
 * Pure mode → capability mapping (PLAN.md §3). Kept free of any `env` / `db`
 * import so it is unit-testable in isolation; `lib/instance.ts` applies it to
 * the runtime `INSTANCE_MODE`. `env.ts` reuses `INSTANCE_MODES` as its enum so
 * the list of modes has a single source of truth.
 *
 * Both modes are self-hosted, single-workspace and invitation-only (accounts come
 * from the first-run /setup wizard or an invite) — so the only thing the mode
 * decides is whether that workspace is personal or an organization.
 */

export const INSTANCE_MODES = ["private-org", "private-solo"] as const;
export type InstanceMode = (typeof INSTANCE_MODES)[number];

export type ModeCapabilities = {
  /** private-org: one organization workspace, grown by invitation. */
  isPrivateOrg: boolean;
  /** private-solo: one personal workspace; org/member/invite UI is hidden. */
  isPrivateSolo: boolean;
};

export function modeCapabilities(mode: InstanceMode): ModeCapabilities {
  return {
    isPrivateOrg: mode === "private-org",
    isPrivateSolo: mode === "private-solo",
  };
}

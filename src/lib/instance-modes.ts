/**
 * Pure mode → capability mapping (PLAN.md §3). Kept free of any `env` / `db`
 * import so it is unit-testable in isolation; `lib/instance.ts` applies it to
 * the runtime `INSTANCE_MODE`. `env.ts` reuses `INSTANCE_MODES` as its enum so
 * the list of modes has a single source of truth.
 */

export const INSTANCE_MODES = ["private-org", "private-solo", "hosted"] as const;
export type InstanceMode = (typeof INSTANCE_MODES)[number];

export type ModeCapabilities = {
  isHosted: boolean;
  isPrivateOrg: boolean;
  isPrivateSolo: boolean;
  /** Either self-hosted single-workspace mode. */
  isPrivate: boolean;
  /** Open, self-service signup (hosted only); otherwise growth is invite-only. */
  allowsSignup: boolean;
  /** Any user may create an organization workspace (hosted only). */
  allowsOrgCreation: boolean;
  /** The first-run /setup wizard runs in the two private modes. */
  hasSetupWizard: boolean;
  /** private-solo: one personal workspace; org/member/invite UI is hidden. */
  isSoloWorkspaceMode: boolean;
};

export function modeCapabilities(mode: InstanceMode): ModeCapabilities {
  const isHosted = mode === "hosted";
  const isPrivateOrg = mode === "private-org";
  const isPrivateSolo = mode === "private-solo";
  const isPrivate = isPrivateOrg || isPrivateSolo;
  return {
    isHosted,
    isPrivateOrg,
    isPrivateSolo,
    isPrivate,
    allowsSignup: isHosted,
    allowsOrgCreation: isHosted,
    hasSetupWizard: isPrivate,
    isSoloWorkspaceMode: isPrivateSolo,
  };
}

import { env } from "./env";
import { modeCapabilities, type InstanceMode } from "./instance-modes";

/**
 * Helpers around `INSTANCE_MODE` — the single switch that decides which routes
 * mount and which setup path runs. The same codebase serves all three modes;
 * mode only gates behavior (see PLAN.md §3). The pure mode → capability logic
 * lives in `instance-modes.ts` (unit-tested there); this module binds it to the
 * runtime mode.
 */

export type { InstanceMode };

export const instanceMode: InstanceMode = env.INSTANCE_MODE;

const caps = modeCapabilities(instanceMode);

export const isHosted = () => caps.isHosted;
export const isPrivateOrg = () => caps.isPrivateOrg;
export const isPrivateSolo = () => caps.isPrivateSolo;

/** Either self-hosted single-workspace mode. */
export const isPrivate = () => caps.isPrivate;

/** Open, self-service signup exists only on the hosted instance. */
export const allowsSignup = () => caps.allowsSignup;

/** Any user may create an organization workspace only on the hosted instance. */
export const allowsOrgCreation = () => caps.allowsOrgCreation;

/** The first-run /setup wizard runs only in the two private (self-host) modes. */
export const hasSetupWizard = () => caps.hasSetupWizard;

/** private-solo provisions one personal workspace; org/member/invite UI is hidden. */
export const isSoloWorkspaceMode = () => caps.isSoloWorkspaceMode;

import { env } from "./env";

/**
 * Helpers around `INSTANCE_MODE` — the single switch that decides which routes
 * mount and which setup path runs. The same codebase serves all three modes;
 * mode only gates behavior (see PLAN.md §3).
 */

export type InstanceMode = (typeof env)["INSTANCE_MODE"];

export const instanceMode: InstanceMode = env.INSTANCE_MODE;

export const isHosted = () => instanceMode === "hosted";
export const isPrivateOrg = () => instanceMode === "private-org";
export const isPrivateSolo = () => instanceMode === "private-solo";

/** Either self-hosted single-workspace mode. */
export const isPrivate = () => isPrivateOrg() || isPrivateSolo();

/** Open, self-service signup exists only on the hosted instance. */
export const allowsSignup = () => isHosted();

/** Any user may create an organization workspace only on the hosted instance. */
export const allowsOrgCreation = () => isHosted();

/** The first-run /setup wizard runs only in the two private (self-host) modes. */
export const hasSetupWizard = () => isPrivate();

/** private-solo provisions one personal workspace; org/member/invite UI is hidden. */
export const isSoloWorkspaceMode = () => isPrivateSolo();

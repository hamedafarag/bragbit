import { env } from "./env";
import { modeCapabilities, type InstanceMode } from "./instance-modes";

/**
 * Helpers around `INSTANCE_MODE` — the single switch that decides which routes
 * mount and which setup path runs. Both modes are self-hosted, single-workspace
 * and invitation-only; the mode only chooses whether that workspace is personal
 * or an organization (see PLAN.md §3). The pure mode → capability logic lives in
 * `instance-modes.ts` (unit-tested there); this module binds it to the runtime
 * mode.
 */

export type { InstanceMode };

export const instanceMode: InstanceMode = env.INSTANCE_MODE;

const caps = modeCapabilities(instanceMode);

/** private-org: one organization workspace, grown by invitation. */
export const isPrivateOrg = () => caps.isPrivateOrg;

/** private-solo: one personal workspace; org/member/invite UI is hidden. */
export const isPrivateSolo = () => caps.isPrivateSolo;

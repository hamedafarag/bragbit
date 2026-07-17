import { describe, expect, it } from "vitest";

import { INSTANCE_MODES, modeCapabilities } from "./instance-modes";

describe("modeCapabilities", () => {
  it("private-org is invitation-only: no open signup, has the setup wizard, not solo", () => {
    const c = modeCapabilities("private-org");
    // No open registration → an account can only be created via an invite token.
    expect(c.allowsSignup).toBe(false);
    expect(c.allowsOrgCreation).toBe(false);
    expect(c.hasSetupWizard).toBe(true);
    expect(c.isSoloWorkspaceMode).toBe(false);
    expect(c.isPrivate).toBe(true);
    expect(c.isHosted).toBe(false);
  });

  it("private-solo hides the invite/member surface and has no open signup", () => {
    const c = modeCapabilities("private-solo");
    expect(c.isSoloWorkspaceMode).toBe(true); // org/member/invite chrome suppressed
    expect(c.allowsSignup).toBe(false);
    expect(c.allowsOrgCreation).toBe(false);
    expect(c.hasSetupWizard).toBe(true);
    expect(c.isPrivate).toBe(true);
  });

  it("hosted allows open signup + user-created orgs and skips the setup wizard", () => {
    const c = modeCapabilities("hosted");
    expect(c.allowsSignup).toBe(true);
    expect(c.allowsOrgCreation).toBe(true);
    expect(c.hasSetupWizard).toBe(false);
    expect(c.isSoloWorkspaceMode).toBe(false);
    expect(c.isPrivate).toBe(false);
  });

  it("maps every declared mode (exactly one of the three flavors is true)", () => {
    for (const mode of INSTANCE_MODES) {
      const c = modeCapabilities(mode);
      expect([c.isHosted, c.isPrivateOrg, c.isPrivateSolo].filter(Boolean)).toHaveLength(1);
    }
  });
});

import { describe, expect, it } from "vitest";

import { INSTANCE_MODES, modeCapabilities } from "./instance-modes";

describe("modeCapabilities", () => {
  it("private-org maps to the organization-workspace flavor", () => {
    const c = modeCapabilities("private-org");
    expect(c.isPrivateOrg).toBe(true);
    expect(c.isPrivateSolo).toBe(false);
  });

  it("private-solo maps to the personal-workspace flavor (org/member/invite chrome suppressed)", () => {
    const c = modeCapabilities("private-solo");
    expect(c.isPrivateSolo).toBe(true);
    expect(c.isPrivateOrg).toBe(false);
  });

  it("maps every declared mode (exactly one flavor is true)", () => {
    for (const mode of INSTANCE_MODES) {
      const c = modeCapabilities(mode);
      expect([c.isPrivateOrg, c.isPrivateSolo].filter(Boolean)).toHaveLength(1);
    }
  });
});

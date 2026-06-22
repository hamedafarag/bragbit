// Unit tests for the instance-mode helpers — they bind the pure mode→capability
// logic (instance-modes.ts, tested separately) to the runtime INSTANCE_MODE. The env
// is mocked with a live getter so each dynamic import sees the mode under test.
import { afterEach, describe, expect, it, vi } from "vitest";

const modeRef = vi.hoisted(() => ({ value: "private-solo" }));
vi.mock("@/lib/env", () => ({
  env: {
    get INSTANCE_MODE() {
      return modeRef.value;
    },
  },
}));

const MODES = ["private-solo", "private-org", "hosted"] as const;

async function loadFor(mode: string) {
  modeRef.value = mode;
  vi.resetModules();
  return import("@/lib/instance");
}

afterEach(() => {
  vi.resetModules();
});

describe("instance mode helpers", () => {
  it("binds every helper to the capability for the active mode", async () => {
    const { modeCapabilities } = await import("@/lib/instance-modes");
    for (const mode of MODES) {
      const inst = await loadFor(mode);
      const caps = modeCapabilities(mode);
      expect(inst.instanceMode).toBe(mode);
      expect(inst.isHosted()).toBe(caps.isHosted);
      expect(inst.isPrivateOrg()).toBe(caps.isPrivateOrg);
      expect(inst.isPrivateSolo()).toBe(caps.isPrivateSolo);
      expect(inst.isPrivate()).toBe(caps.isPrivate);
      expect(inst.allowsSignup()).toBe(caps.allowsSignup);
      expect(inst.allowsOrgCreation()).toBe(caps.allowsOrgCreation);
      expect(inst.hasSetupWizard()).toBe(caps.hasSetupWizard);
      expect(inst.isSoloWorkspaceMode()).toBe(caps.isSoloWorkspaceMode);
    }
  });

  it("hosted enables signup + org creation and skips the setup wizard", async () => {
    const inst = await loadFor("hosted");
    expect(inst.isHosted()).toBe(true);
    expect(inst.allowsSignup()).toBe(true);
    expect(inst.allowsOrgCreation()).toBe(true);
    expect(inst.hasSetupWizard()).toBe(false);
    expect(inst.isPrivate()).toBe(false);
  });

  it("private-solo is one personal workspace with the setup wizard", async () => {
    const inst = await loadFor("private-solo");
    expect(inst.isPrivateSolo()).toBe(true);
    expect(inst.isPrivate()).toBe(true);
    expect(inst.isSoloWorkspaceMode()).toBe(true);
    expect(inst.hasSetupWizard()).toBe(true);
    expect(inst.allowsSignup()).toBe(false);
  });

  it("private-org is invitation-only with members", async () => {
    const inst = await loadFor("private-org");
    expect(inst.isPrivateOrg()).toBe(true);
    expect(inst.isPrivate()).toBe(true);
    expect(inst.isSoloWorkspaceMode()).toBe(false);
    expect(inst.allowsOrgCreation()).toBe(false);
    expect(inst.hasSetupWizard()).toBe(true);
  });
});

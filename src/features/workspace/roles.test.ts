import { describe, expect, it } from "vitest";

import { canAdminister, canManageMember, canTransferOwnershipTo } from "./roles";

describe("canAdminister", () => {
  it("admits owners and admins, not members", () => {
    expect(canAdminister("owner")).toBe(true);
    expect(canAdminister("admin")).toBe(true);
    expect(canAdminister("member")).toBe(false);
    expect(canAdminister("")).toBe(false);
  });
});

describe("canManageMember", () => {
  it("lets an owner/admin manage another non-owner member", () => {
    expect(canManageMember("owner", "member", false)).toBe(true);
    expect(canManageMember("admin", "member", false)).toBe(true);
    expect(canManageMember("owner", "admin", false)).toBe(true);
  });

  it("never lets the owner be managed through these controls", () => {
    expect(canManageMember("admin", "owner", false)).toBe(false);
    expect(canManageMember("owner", "owner", false)).toBe(false);
  });

  it("excludes self and non-administering actors", () => {
    expect(canManageMember("owner", "member", true)).toBe(false);
    expect(canManageMember("member", "member", false)).toBe(false);
  });
});

describe("canTransferOwnershipTo", () => {
  it("only the owner can transfer, and only to another non-owner", () => {
    expect(canTransferOwnershipTo("owner", "member", false)).toBe(true);
    expect(canTransferOwnershipTo("owner", "admin", false)).toBe(true);
  });

  it("admins can't transfer; you can't transfer to the owner or yourself", () => {
    expect(canTransferOwnershipTo("admin", "member", false)).toBe(false);
    expect(canTransferOwnershipTo("owner", "owner", false)).toBe(false);
    expect(canTransferOwnershipTo("owner", "member", true)).toBe(false);
  });
});

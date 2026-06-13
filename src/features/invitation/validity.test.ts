import { describe, expect, it } from "vitest";

import { isAcceptableInvitation } from "./validity";

const now = new Date("2026-06-13T12:00:00Z");
const future = new Date("2026-06-20T12:00:00Z"); // +7d, like a fresh invite
const past = new Date("2026-06-06T12:00:00Z"); // expired

describe("isAcceptableInvitation", () => {
  it("accepts a pending, unexpired invitation", () => {
    expect(isAcceptableInvitation({ status: "pending", expiresAt: future }, now)).toBe(true);
  });

  it("rejects an expired invitation even while pending", () => {
    expect(isAcceptableInvitation({ status: "pending", expiresAt: past }, now)).toBe(false);
  });

  it("rejects a reused invitation — any non-pending status", () => {
    for (const status of ["accepted", "canceled", "rejected"]) {
      expect(isAcceptableInvitation({ status, expiresAt: future }, now)).toBe(false);
    }
  });

  it("rejects exactly at the expiry instant (not strictly in the future)", () => {
    expect(isAcceptableInvitation({ status: "pending", expiresAt: now }, now)).toBe(false);
  });
});

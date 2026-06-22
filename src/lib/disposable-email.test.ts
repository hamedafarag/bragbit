// DB-gated only because importing @/lib/disposable-email pulls @/lib/env (needs
// DATABASE_URL); the assertions are pure. isHosted is mocked to drive the gate.
import { describe, expect, it, vi } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

const inst = vi.hoisted(() => ({ hosted: true }));
vi.mock("@/lib/instance", () => ({ isHosted: () => inst.hosted }));

async function load() {
  return import("@/lib/disposable-email");
}

describe.skipIf(!hasDb)("disposable email", () => {
  it("isDisposableEmail flags known throwaway domains (case-insensitive), allows the rest", async () => {
    const { isDisposableEmail } = await load();
    expect(isDisposableEmail("x@mailinator.com")).toBe(true);
    expect(isDisposableEmail("X@Guerrillamail.com")).toBe(true);
    expect(isDisposableEmail("a@yopmail.com")).toBe(true);
    expect(isDisposableEmail("real@gmail.com")).toBe(false);
    expect(isDisposableEmail("dev@bragbit.local")).toBe(false);
  });

  it("assertSignupEmailAllowed rejects disposable on hosted, no-ops otherwise", async () => {
    const { assertSignupEmailAllowed } = await load();

    inst.hosted = true;
    await expect(assertSignupEmailAllowed({ email: "x@mailinator.com" })).rejects.toThrow(
      /disposable/i,
    );
    await expect(assertSignupEmailAllowed({ email: "real@gmail.com" })).resolves.toBeUndefined();

    // Private modes don't block (invitation-only; signup is gated upstream).
    inst.hosted = false;
    await expect(assertSignupEmailAllowed({ email: "x@mailinator.com" })).resolves.toBeUndefined();
    inst.hosted = true;
  });
});

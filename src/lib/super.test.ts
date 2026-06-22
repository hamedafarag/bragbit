// DB-gated only because importing @/lib/super pulls @/lib/env (which needs
// DATABASE_URL); the assertions themselves are pure. The allowlist is empty in the
// test env, so isSuperadmin's positive path is covered by the hosted /super e2e.
import { describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

async function load() {
  return import("@/lib/super");
}

describe.skipIf(!hasDb)("superadmin allowlist", () => {
  it("parseSuperadminEmails lowercases, splits on commas/whitespace, drops blanks", async () => {
    const { parseSuperadminEmails } = await load();
    expect([...parseSuperadminEmails("A@x.com, b@Y.com  c@z.com,,")].sort()).toEqual([
      "a@x.com",
      "b@y.com",
      "c@z.com",
    ]);
    expect(parseSuperadminEmails("").size).toBe(0);
    expect(parseSuperadminEmails("   ").size).toBe(0);
    expect(parseSuperadminEmails(null).size).toBe(0);
    expect(parseSuperadminEmails(undefined).size).toBe(0);
  });

  it("isSuperadmin is false for everyone when the allowlist is empty", async () => {
    const { isSuperadmin } = await load();
    expect(isSuperadmin("anyone@bragbit.local")).toBe(false);
    expect(isSuperadmin(null)).toBe(false);
    expect(isSuperadmin(undefined)).toBe(false);
  });
});

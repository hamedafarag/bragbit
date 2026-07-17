import { describe, expect, it } from "vitest";

// crypto.ts derives its key from the app secret via @/lib/env, which validates at
// import. Provide the minimum env here (no Postgres needed) and dynamic-import the
// module after, so this pure-logic test runs under both `pnpm test` and `test:db`.
process.env.DATABASE_URL ??= "postgres://localhost/bragbit_test";
process.env.BETTER_AUTH_SECRET ??= "0123456789abcdef0123456789abcdef";

const { encryptToken, decryptToken } = await import("./crypto");

describe("integration token crypto", () => {
  it("round-trips a variety of inputs", () => {
    for (const plaintext of [
      "gho_exampleAccessToken1234567890",
      "", // empty
      "unicode ✓ — café — 日本語",
      "x".repeat(5000), // long
    ]) {
      expect(decryptToken(encryptToken(plaintext))).toBe(plaintext);
    }
  });

  it("produces a versioned ciphertext that isn't the plaintext", () => {
    const enc = encryptToken("secret-token");
    expect(enc.startsWith("v1.")).toBe(true);
    expect(enc).not.toContain("secret-token");
  });

  it("is non-deterministic (fresh IV per call) yet both decrypt", () => {
    const a = encryptToken("same");
    const b = encryptToken("same");
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe("same");
    expect(decryptToken(b)).toBe("same");
  });

  it("rejects tampered ciphertext (GCM auth tag)", () => {
    const enc = encryptToken("do-not-tamper");
    const body = Buffer.from(enc.slice(3), "base64url");
    body[body.length - 1] ^= 0x01; // flip a bit in the ciphertext
    const tampered = `v1.${body.toString("base64url")}`;
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("rejects an unrecognized or malformed payload", () => {
    expect(() => decryptToken("garbage")).toThrow(/Unrecognized/);
    expect(() => decryptToken("v2.abcd")).toThrow(/Unrecognized/);
    expect(() => decryptToken("v1.tooshort")).toThrow(/Malformed/);
  });
});

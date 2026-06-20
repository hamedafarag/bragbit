import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { buildCsp, proxy } from "./proxy";

describe("buildCsp", () => {
  it("locks script-src to the nonce + strict-dynamic and keeps the baseline", () => {
    const csp = buildCsp("abc123", false);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("allows 'unsafe-eval' only in development", () => {
    expect(buildCsp("x", true)).toContain("'unsafe-eval'");
    expect(buildCsp("x", false)).not.toContain("'unsafe-eval'");
  });
});

describe("proxy", () => {
  const nonceOf = (req: NextRequest) =>
    proxy(req)
      .headers.get("content-security-policy")
      ?.match(/'nonce-([^']+)'/)?.[1];

  it("emits a CSP carrying a per-request nonce", () => {
    expect(nonceOf(new NextRequest("http://localhost/dashboard"))).toBeTruthy();
  });

  it("generates a fresh nonce for every request", () => {
    const a = nonceOf(new NextRequest("http://localhost/"));
    const b = nonceOf(new NextRequest("http://localhost/"));
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });
});

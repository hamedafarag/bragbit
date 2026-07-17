import { describe, expect, it } from "vitest";

// The registry imports github.ts, which reads @/lib/env at import (no DB). Provide
// the minimum env, then dynamic-import.
process.env.DATABASE_URL ??= "postgres://localhost/bragbit_test";
process.env.BETTER_AUTH_SECRET ??= "0123456789abcdef0123456789abcdef";

const { getProvider, availableProviders, availableProviderDescriptors } = await import("./index");
const { isProviderAvailable } = await import("./types");

describe("provider registry", () => {
  it("resolves the GitHub adapter by id", () => {
    expect(getProvider("github").id).toBe("github");
  });

  it("lists GitHub as available via its PAT path even with no OAuth env", () => {
    const available = availableProviders();
    expect(available.map((p) => p.id)).toContain("github");
    // supportsPat makes it reachable regardless of OAuth config
    expect(isProviderAvailable(getProvider("github"))).toBe(true);
  });

  it("exposes plain, serializable descriptors for client components", () => {
    const d = availableProviderDescriptors().find((p) => p.id === "github");
    expect(d).toMatchObject({ id: "github", label: "GitHub", supportsPat: true });
    expect(typeof d!.oauthConfigured).toBe("boolean");
  });
});

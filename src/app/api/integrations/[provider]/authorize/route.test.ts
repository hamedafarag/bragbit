import { describe, expect, it, vi } from "vitest";

// The route reads @/lib/env (no DB). Provide the minimum, then dynamic-import.
process.env.DATABASE_URL ??= "postgres://localhost/bragbit_test";
process.env.BETTER_AUTH_SECRET ??= "0123456789abcdef0123456789abcdef";
process.env.APP_URL ??= "http://localhost:3000";

const guard = vi.hoisted(() => ({
  access: null as null | { user: { id: string }; workspaceId: string },
}));
vi.mock("@/lib/auth/guards", () => ({ getWorkspaceOrNull: async () => guard.access }));

const oauth = vi.hoisted(() => ({ configured: true }));
vi.mock("@/features/integrations/providers", () => ({
  getProvider: (id: string) => ({
    oauthConfigured: () => oauth.configured,
    authorizeUrl: (state: string) => `https://provider.example/authorize?p=${id}&state=${state}`,
  }),
}));
vi.mock("@/features/integrations/service", () => ({
  oauthStateCookie: (p: string) => `bragbit_oauth_state_${p}`,
}));

const { GET } = await import("./route");

const req = () => new Request("http://localhost:3000/api/integrations/x/authorize");
const ctx = (provider: string) => ({ params: Promise.resolve({ provider }) });

describe("GET /api/integrations/[provider]/authorize", () => {
  it("rejects an unknown provider back to settings (no status)", async () => {
    guard.access = { user: { id: "u1" }, workspaceId: "w1" };
    const res = await GET(req(), ctx("bogus"));
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("/settings#integrations");
    expect(loc).not.toContain("integration=");
  });

  it("sends an unauthenticated caller to sign-in", async () => {
    guard.access = null;
    const res = await GET(req(), ctx("github"));
    expect(res.headers.get("location")).toContain("/sign-in");
  });

  it("falls back to settings when the provider's OAuth isn't configured", async () => {
    guard.access = { user: { id: "u1" }, workspaceId: "w1" };
    oauth.configured = false;
    const res = await GET(req(), ctx("github"));
    expect(res.headers.get("location")).toContain("integration=github_unavailable");
  });

  it("redirects to the provider and stores the state in a per-provider cookie", async () => {
    guard.access = { user: { id: "u1" }, workspaceId: "w1" };
    oauth.configured = true;
    const res = await GET(req(), ctx("linear"));

    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("provider.example/authorize");
    const state = new URL(loc).searchParams.get("state");
    expect(state).toBeTruthy();
    // the CSRF cookie is keyed per-provider and holds exactly the state we sent
    expect(res.cookies.get("bragbit_oauth_state_linear")?.value).toBe(state);
  });
});

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
  getProvider: () => ({
    oauthConfigured: () => oauth.configured,
    authorizeUrl: (state: string) => `https://github.com/login/oauth/authorize?state=${state}`,
  }),
}));
vi.mock("@/features/integrations/service", () => ({
  OAUTH_STATE_COOKIE: "bragbit_gh_oauth_state",
}));

const { GET } = await import("./route");

describe("GET /api/integrations/github/authorize", () => {
  it("sends an unauthenticated caller to sign-in", async () => {
    guard.access = null;
    const res = await GET();
    expect(res.headers.get("location")).toContain("/sign-in");
  });

  it("falls back to settings when OAuth isn't configured", async () => {
    guard.access = { user: { id: "u1" }, workspaceId: "w1" };
    oauth.configured = false;
    const res = await GET();
    expect(res.headers.get("location")).toContain("integration=github_unavailable");
  });

  it("redirects to GitHub and stores the state in a cookie when configured", async () => {
    guard.access = { user: { id: "u1" }, workspaceId: "w1" };
    oauth.configured = true;
    const res = await GET();

    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("github.com/login/oauth/authorize");
    const state = new URL(loc).searchParams.get("state");
    expect(state).toBeTruthy();
    // the CSRF cookie holds exactly the state we sent to GitHub
    expect(res.cookies.get("bragbit_gh_oauth_state")?.value).toBe(state);
  });
});

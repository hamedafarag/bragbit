import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgres://localhost/bragbit_test";
process.env.BETTER_AUTH_SECRET ??= "0123456789abcdef0123456789abcdef";
process.env.APP_URL ??= "http://localhost:3000";

const guard = vi.hoisted(() => ({
  access: { user: { id: "u1" }, workspaceId: "w1" } as null | {
    user: { id: string };
    workspaceId: string;
  },
}));
vi.mock("@/lib/auth/guards", () => ({ getWorkspaceOrNull: async () => guard.access }));

const gh = vi.hoisted(() => ({ throwOnExchange: false }));
vi.mock("@/features/integrations/providers", () => ({
  getProvider: () => ({
    exchangeCode: async () => {
      if (gh.throwOnExchange) throw new Error("exchange failed");
      return {
        accessToken: "gho_abc",
        externalAccountId: "7",
        externalAccountLabel: "octocat",
        scopes: "read:user",
      };
    },
  }),
}));

const upsert = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/features/integrations/service", () => ({
  OAUTH_STATE_COOKIE: "bragbit_gh_oauth_state",
  upsertConnection: upsert,
}));

const { GET } = await import("./route");

/** A callback request with the given query params and (optionally) a state cookie. */
function req(query: Record<string, string>, cookieState?: string) {
  const url = new URL("http://localhost:3000/api/integrations/github/callback");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const headers: Record<string, string> = {};
  if (cookieState) headers.cookie = `bragbit_gh_oauth_state=${cookieState}`;
  return new NextRequest(url, { headers });
}

describe("GET /api/integrations/github/callback", () => {
  it("refuses when the state doesn't match the cookie (CSRF guard)", async () => {
    guard.access = { user: { id: "u1" }, workspaceId: "w1" };
    const res = await GET(req({ code: "c", state: "aaa" }, "bbb"));
    expect(res.headers.get("location")).toContain("integration=github_failed");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("exchanges and stores the connection on a valid callback", async () => {
    guard.access = { user: { id: "u1" }, workspaceId: "w1" };
    gh.throwOnExchange = false;
    upsert.mockClear();
    const res = await GET(req({ code: "c", state: "match" }, "match"));
    expect(res.headers.get("location")).toContain("integration=github_connected");
    expect(upsert).toHaveBeenCalledWith(
      "u1",
      "w1",
      "github",
      "oauth",
      expect.objectContaining({ accessToken: "gho_abc", externalAccountLabel: "octocat" }),
    );
  });

  it("reports failure when the token exchange throws", async () => {
    guard.access = { user: { id: "u1" }, workspaceId: "w1" };
    gh.throwOnExchange = true;
    upsert.mockClear();
    const res = await GET(req({ code: "c", state: "match" }, "match"));
    expect(res.headers.get("location")).toContain("integration=github_failed");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("sends an unauthenticated caller to sign-in", async () => {
    guard.access = null;
    const res = await GET(req({ code: "c", state: "match" }, "match"));
    expect(res.headers.get("location")).toContain("/sign-in");
  });
});

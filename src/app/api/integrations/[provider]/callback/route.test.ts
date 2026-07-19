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

const prov = vi.hoisted(() => ({ throwOnExchange: false }));
vi.mock("@/features/integrations/providers", () => ({
  getProvider: () => ({
    exchangeCode: async () => {
      if (prov.throwOnExchange) throw new Error("exchange failed");
      return {
        accessToken: "lin_at",
        externalAccountId: "U1",
        externalAccountLabel: "Ada",
        scopes: "read",
      };
    },
  }),
}));

const upsert = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/features/integrations/service", () => ({
  oauthStateCookie: (p: string) => `bragbit_oauth_state_${p}`,
  upsertConnection: upsert,
}));

const { GET } = await import("./route");

/** A callback request for `provider` with the given query params and (optionally) a state cookie. */
function req(provider: string, query: Record<string, string>, cookieState?: string) {
  const url = new URL(`http://localhost:3000/api/integrations/${provider}/callback`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const headers: Record<string, string> = {};
  if (cookieState) headers.cookie = `bragbit_oauth_state_${provider}=${cookieState}`;
  return new NextRequest(url, { headers });
}
const ctx = (provider: string) => ({ params: Promise.resolve({ provider }) });

describe("GET /api/integrations/[provider]/callback", () => {
  it("rejects an unknown provider back to settings without exchanging", async () => {
    upsert.mockClear();
    const res = await GET(req("bogus", { code: "c", state: "s" }, "s"), ctx("bogus"));
    expect(res.headers.get("location")).toContain("/settings#integrations");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses when the state doesn't match the cookie (CSRF guard)", async () => {
    guard.access = { user: { id: "u1" }, workspaceId: "w1" };
    upsert.mockClear();
    const res = await GET(req("linear", { code: "c", state: "aaa" }, "bbb"), ctx("linear"));
    expect(res.headers.get("location")).toContain("integration=linear_failed");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("exchanges and stores the connection for the callback's provider", async () => {
    guard.access = { user: { id: "u1" }, workspaceId: "w1" };
    prov.throwOnExchange = false;
    upsert.mockClear();
    const res = await GET(req("linear", { code: "c", state: "match" }, "match"), ctx("linear"));
    expect(res.headers.get("location")).toContain("integration=linear_connected");
    expect(upsert).toHaveBeenCalledWith(
      "u1",
      "w1",
      "linear",
      "oauth",
      expect.objectContaining({ accessToken: "lin_at", externalAccountLabel: "Ada" }),
    );
  });

  it("reports failure when the token exchange throws", async () => {
    guard.access = { user: { id: "u1" }, workspaceId: "w1" };
    prov.throwOnExchange = true;
    upsert.mockClear();
    const res = await GET(req("linear", { code: "c", state: "match" }, "match"), ctx("linear"));
    expect(res.headers.get("location")).toContain("integration=linear_failed");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("sends an unauthenticated caller to sign-in", async () => {
    guard.access = null;
    const res = await GET(req("github", { code: "c", state: "match" }, "match"), ctx("github"));
    expect(res.headers.get("location")).toContain("/sign-in");
  });
});

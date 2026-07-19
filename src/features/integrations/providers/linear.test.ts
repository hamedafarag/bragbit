import { afterEach, describe, expect, it, vi } from "vitest";

import type { DecryptedConnection } from "./types";

// linear.ts reads @/lib/env at import (no DB). Provide the minimum env plus the Linear
// OAuth creds (so oauthConfigured() is true and exchange/refresh have client creds),
// then dynamic-import. Linear is reached only through global fetch, stubbed per test.
process.env.DATABASE_URL ??= "postgres://localhost/bragbit_test";
process.env.BETTER_AUTH_SECRET ??= "0123456789abcdef0123456789abcdef";
process.env.APP_URL ??= "http://localhost:3000";
process.env.LINEAR_IMPORT_CLIENT_ID ??= "lin_client";
process.env.LINEAR_IMPORT_CLIENT_SECRET ??= "lin_secret";

const { linearProvider } = await import("./linear");

/** A fresh JSON Response (200 by default) — fresh so a body can't be re-read across calls. */
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}
/** The Authorization header a fetch call was made with. */
function authOf(mock: ReturnType<typeof vi.fn>, call = 0): string | undefined {
  const init = mock.mock.calls[call]?.[1] as RequestInit | undefined;
  return (init?.headers as Record<string, string> | undefined)?.Authorization;
}

const oauthConn: DecryptedConnection = {
  id: "c1",
  provider: "linear",
  authType: "oauth",
  externalAccountLabel: "Ada Lovelace",
  accessToken: "lin_oauth_tok",
  refreshToken: "lin_refresh",
  accessTokenExpiresAt: new Date("2999-01-01T00:00:00Z"),
  config: null,
};
const patConn: DecryptedConnection = {
  ...oauthConn,
  authType: "pat",
  accessToken: "lin_api_key",
  refreshToken: null,
  accessTokenExpiresAt: null,
};

afterEach(() => vi.unstubAllGlobals());

describe("linearProvider.oauthConfigured / authorizeUrl", () => {
  it("is configured when the Linear OAuth app creds are set", () => {
    expect(linearProvider.oauthConfigured()).toBe(true);
    expect(linearProvider.supportsPat).toBe(true);
  });

  it("builds the Linear consent URL with the read scope, state, and callback", () => {
    const url = new URL(linearProvider.authorizeUrl("st8"));
    expect(url.origin + url.pathname).toBe("https://linear.app/oauth/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("read");
    expect(url.searchParams.get("state")).toBe("st8");
    expect(url.searchParams.get("redirect_uri")).toContain("/api/integrations/linear/callback");
  });
});

describe("linearProvider.validatePat", () => {
  it("authenticates an API key with the RAW header (no Bearer) and resolves identity", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ data: { viewer: { id: "U1", name: "Ada Lovelace" } } }));
    vi.stubGlobal("fetch", fetchMock);

    const t = await linearProvider.validatePat("lin_api_key");
    expect(t).toMatchObject({
      accessToken: "lin_api_key",
      externalAccountId: "U1",
      externalAccountLabel: "Ada Lovelace",
    });
    expect(authOf(fetchMock)).toBe("lin_api_key"); // raw key, not "Bearer …"
  });

  it("throws a user-facing error when Linear rejects the key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(json({ errors: [{ message: "auth" }] }, 401)),
    );
    await expect(linearProvider.validatePat("bad")).rejects.toThrow(/rejected/i);
  });
});

describe("linearProvider.exchangeCode", () => {
  it("exchanges a code, keeps the refresh token + expiry, and resolves the account via Bearer", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json({ access_token: "lin_at", refresh_token: "lin_rt", expires_in: 86399, scope: "read" }),
      )
      .mockResolvedValueOnce(json({ data: { viewer: { id: "U9", name: "Grace" } } }));
    vi.stubGlobal("fetch", fetchMock);

    const t = await linearProvider.exchangeCode("code123");
    expect(t).toMatchObject({
      accessToken: "lin_at",
      refreshToken: "lin_rt",
      scopes: "read",
      externalAccountId: "U9",
      externalAccountLabel: "Grace",
    });
    expect(t.accessTokenExpiresAt).toBeInstanceOf(Date);
    expect(String(fetchMock.mock.calls[0]![0])).toContain("/oauth/token");
    expect(authOf(fetchMock, 1)).toBe("Bearer lin_at"); // identity call uses Bearer
  });

  it("throws when Linear returns no access token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ error: "invalid_grant" })));
    await expect(linearProvider.exchangeCode("bad")).rejects.toThrow(/access token/i);
  });
});

describe("linearProvider.refreshTokens", () => {
  it("posts grant_type=refresh_token and returns fresh tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      json({
        access_token: "lin_at2",
        refresh_token: "lin_rt2",
        expires_in: 86399,
        scope: "read",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const t = await linearProvider.refreshTokens!("lin_rt");
    expect(t).toMatchObject({ accessToken: "lin_at2", refreshToken: "lin_rt2", scopes: "read" });
    expect(t.accessTokenExpiresAt).toBeInstanceOf(Date);
    const body = String((fetchMock.mock.calls[0]![1] as RequestInit).body);
    expect(body).toContain("grant_type=refresh_token");
    expect(body).toContain("refresh_token=lin_rt");
  });
});

describe("linearProvider.fetchCandidates", () => {
  const nodes = [
    {
      id: "issue-uuid-1",
      identifier: "ENG-42",
      title: "Ship the crew heatmap",
      description: "Rendered the realtime heatmap.",
      url: "https://linear.app/acme/issue/ENG-42",
      completedAt: "2026-03-02T09:00:00Z",
      team: { key: "ENG", name: "Platform" },
    },
  ];
  const ok = () => json({ data: { viewer: { assignedIssues: { nodes } } } });
  const empty = () => json({ data: { viewer: { assignedIssues: { nodes: [] } } } });

  it("normalizes completed issues into candidates (issue source type)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(ok()));
    const [c] = await linearProvider.fetchCandidates(patConn);
    expect(c).toMatchObject({
      externalId: "issue-uuid-1",
      externalUrl: "https://linear.app/acme/issue/ENG-42",
      sourceType: "issue",
      title: "Ship the crew heatmap",
      payload: { identifier: "ENG-42", team: "Platform", body: "Rendered the realtime heatmap." },
    });
    expect(c!.occurredAt?.toISOString()).toBe("2026-03-02T09:00:00.000Z");
  });

  it("uses the raw API-key header for a PAT connection", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(empty());
    vi.stubGlobal("fetch", fetchMock);
    await linearProvider.fetchCandidates(patConn);
    expect(authOf(fetchMock)).toBe("lin_api_key");
  });

  it("uses the Bearer header for an OAuth connection", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(empty());
    vi.stubGlobal("fetch", fetchMock);
    await linearProvider.fetchCandidates(oauthConn);
    expect(authOf(fetchMock)).toBe("Bearer lin_oauth_tok");
  });

  it("throws a redacted error when Linear returns GraphQL errors (no leak)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ errors: [{ message: "internal detail that must not leak" }] })),
    );
    const err = await linearProvider.fetchCandidates(patConn).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/reconnect/i);
    expect((err as Error).message).not.toContain("internal detail");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import type { DecryptedConnection } from "./types";

// github.ts reads @/lib/env (validated at import) but needs no DB. Provide the
// minimum env, then dynamic-import so this runs under plain `pnpm test`. GitHub is
// reached only through global fetch, which we stub per test.
process.env.DATABASE_URL ??= "postgres://localhost/bragbit_test";
process.env.BETTER_AUTH_SECRET ??= "0123456789abcdef0123456789abcdef";

const { githubProvider } = await import("./github");

function stubFetch(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
  const res = new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: init?.headers,
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res));
}

const conn: DecryptedConnection = {
  id: "c1",
  provider: "github",
  authType: "pat",
  externalAccountLabel: "octocat",
  accessToken: "tok",
  refreshToken: null,
  accessTokenExpiresAt: null,
  config: null,
};

afterEach(() => vi.unstubAllGlobals());

describe("githubProvider.validatePat", () => {
  it("resolves the account identity and scopes header", async () => {
    stubFetch(
      { id: 583231, login: "octocat" },
      { headers: { "x-oauth-scopes": "repo, read:user" } },
    );
    const t = await githubProvider.validatePat("ghp_x");
    expect(t).toMatchObject({
      accessToken: "ghp_x",
      externalAccountId: "583231",
      externalAccountLabel: "octocat",
      scopes: "repo, read:user",
    });
  });

  it("throws a user-facing error when GitHub rejects the token", async () => {
    stubFetch({ message: "Bad credentials" }, { status: 401 });
    await expect(githubProvider.validatePat("bad")).rejects.toThrow(/rejected/i);
  });
});

describe("githubProvider.exchangeCode", () => {
  it("exchanges a code for a token, then resolves the account", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "gho_abc", scope: "read:user,public_repo" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 7, login: "octocat" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const t = await githubProvider.exchangeCode("code123");
    expect(t).toMatchObject({
      accessToken: "gho_abc",
      externalAccountId: "7",
      externalAccountLabel: "octocat",
      scopes: "read:user,public_repo",
    });
    expect(String(fetchMock.mock.calls[0]![0])).toContain("login/oauth/access_token");
  });

  it("throws when GitHub returns no access token", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "bad_verification_code" }), { status: 200 }),
        ),
    );
    await expect(githubProvider.exchangeCode("bad")).rejects.toThrow(/access token/i);
  });
});

describe("githubProvider.fetchCandidates", () => {
  it("normalizes merged PRs into candidates", async () => {
    stubFetch({
      items: [
        {
          node_id: "PR_kwDO1",
          number: 42,
          title: "Fix the flaky import test",
          html_url: "https://github.com/acme/web/pull/42",
          body: "Body text",
          closed_at: "2026-03-01T00:00:00Z",
          repository_url: "https://api.github.com/repos/acme/web",
          pull_request: { merged_at: "2026-03-02T09:00:00Z" },
        },
      ],
    });
    const [c] = await githubProvider.fetchCandidates(conn);
    expect(c).toMatchObject({
      externalId: "PR_kwDO1",
      externalUrl: "https://github.com/acme/web/pull/42",
      sourceType: "pull_request",
      title: "Fix the flaky import test",
      payload: { number: 42, repo: "acme/web", body: "Body text" },
    });
    expect(c!.occurredAt?.toISOString()).toBe("2026-03-02T09:00:00.000Z"); // prefers merged_at
  });

  it("refuses a connection with no account handle", async () => {
    await expect(
      githubProvider.fetchCandidates({ ...conn, externalAccountLabel: null }),
    ).rejects.toThrow(/handle/i);
  });
});

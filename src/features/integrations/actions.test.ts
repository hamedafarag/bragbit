// DB-gated integration tests for the integrations server actions (slice 1b).
// Pure Drizzle behind a mocked requireWorkspace, with the provider adapter stubbed
// so no network is hit. Exercises PAT connect (token stored encrypted), import +
// dedup, approve (reuses features/brag, attaches the source link), dismiss, and
// disconnect (cascade). Skipped unless DATABASE_URL is set.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

const authCtx = vi.hoisted(() => ({ workspaceId: "", user: { id: "" } }));
vi.mock("@/lib/auth/guards", () => ({ requireWorkspace: async () => authCtx }));

// Stub the provider so the actions never call GitHub. `candidates` is mutable so a
// test can control what an import returns (and prove dedup on a second run). The
// refresh/revoke spies let the OAuth-token tests assert the actions drive the adapter.
const stub = vi.hoisted(() => ({
  candidates: [] as Array<Record<string, unknown>>,
  refreshTokens: vi.fn(async () => ({
    accessToken: "refreshed_at",
    refreshToken: "refreshed_rt",
    accessTokenExpiresAt: new Date(Date.now() + 3600_000),
    scopes: "read",
  })),
  revokeToken: vi.fn(async () => {}),
}));
vi.mock("./providers", () => ({
  getProvider: () => ({
    id: "github",
    label: "GitHub",
    supportsPat: true,
    oauthConfigured: () => false,
    authorizeUrl: () => "",
    exchangeCode: async () => {
      throw new Error("unused");
    },
    validatePat: async (token: string) => ({
      accessToken: token,
      externalAccountId: "42",
      externalAccountLabel: "octocat",
    }),
    fetchCandidates: async () => stub.candidates,
    refreshTokens: stub.refreshTokens,
    revokeToken: stub.revokeToken,
  }),
}));

async function load() {
  const [dbMod, schema, drizzle, actions, queries] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db/schema"),
    import("drizzle-orm"),
    import("./actions"),
    import("./queries"),
  ]);
  return {
    db: dbMod.db,
    schema,
    eq: drizzle.eq,
    inArray: drizzle.inArray,
    ...actions,
    ...queries,
  };
}

function pr(sfx: string, over: Record<string, unknown> = {}) {
  return {
    externalId: `PR_${sfx}`,
    externalUrl: `https://github.com/acme/web/pull/${sfx}`,
    sourceType: "pull_request",
    title: `PR ${sfx}`,
    occurredAt: new Date("2026-03-01T00:00:00Z"),
    payload: { number: Number(sfx) || 1, repo: "acme/web", body: "" },
    ...over,
  };
}

describe.skipIf(!hasDb)("integrations server actions", () => {
  let mod: Awaited<ReturnType<typeof load>>;
  const orgIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    mod = await load();
  });

  /** Seed an org, the caller, and a document they own; point the mocked guard at them. */
  async function seed(sfx: string) {
    const { db, schema } = mod;
    const ids = { org: `intact-org-${sfx}`, user: `intact-user-${sfx}`, doc: `intact-doc-${sfx}` };
    await db.insert(schema.organization).values({ id: ids.org, name: `Int ${sfx}`, slug: ids.org });
    await db.insert(schema.user).values({ id: ids.user, name: "U", email: `${ids.user}@t.local` });
    await db
      .insert(schema.document)
      .values({ id: ids.doc, workspaceId: ids.org, userId: ids.user, title: "Doc" });
    orgIds.push(ids.org);
    userIds.push(ids.user);
    authCtx.workspaceId = ids.org;
    authCtx.user.id = ids.user;
    return ids;
  }

  afterEach(async () => {
    const { db, schema, inArray } = mod;
    if (userIds.length) await db.delete(schema.user).where(inArray(schema.user.id, userIds));
    if (orgIds.length)
      await db.delete(schema.organization).where(inArray(schema.organization.id, orgIds));
    userIds.length = 0;
    orgIds.length = 0;
    stub.candidates = [];
  });

  afterAll(async () => {
    await (
      globalThis as { __bragbitClient?: { end?: (o?: unknown) => Promise<void> } }
    ).__bragbitClient
      ?.end?.({ timeout: 5 })
      .catch(() => {});
  });

  it("connectPat stores the connection with an encrypted token", async () => {
    const { db, schema, eq } = mod;
    await seed("connect");
    expect(await mod.connectPat({ provider: "github", token: "ghp_secret" })).toEqual({ ok: true });

    const [row] = await db
      .select()
      .from(schema.integrationConnection)
      .where(eq(schema.integrationConnection.userId, authCtx.user.id));
    expect(row).toMatchObject({ authType: "pat", externalAccountLabel: "octocat" });
    expect(row!.accessToken.startsWith("v1.")).toBe(true);
    expect(row!.accessToken).not.toContain("ghp_secret");

    // read layer surfaces it without any token columns
    const list = await mod.listConnections(authCtx.user.id, authCtx.workspaceId);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ provider: "github", authType: "pat" });
    expect((list[0] as Record<string, unknown>).accessToken).toBeUndefined();
    expect(await mod.getConnection(authCtx.user.id, authCtx.workspaceId, "github")).not.toBeNull();
  });

  it("importNow inserts candidates and dedups on re-run", async () => {
    await seed("import");
    await mod.connectPat({ provider: "github", token: "t" });
    stub.candidates = [pr("1"), pr("2")];

    expect(await mod.importNow("github")).toEqual({ ok: true, imported: 2 });
    expect(await mod.importNow("github")).toEqual({ ok: true, imported: 0 }); // dedup
    expect(await mod.listCandidates(authCtx.user.id, authCtx.workspaceId)).toHaveLength(2);
  });

  it("approveCandidate creates a brag with the source link and marks it approved", async () => {
    const { db, schema, eq } = mod;
    const ids = await seed("approve");
    await mod.connectPat({ provider: "github", token: "t" });
    stub.candidates = [
      pr("9", { title: "Ship it", payload: { number: 9, repo: "acme/web", body: "details" } }),
    ];
    await mod.importNow("github");
    const [cand] = await mod.listCandidates(authCtx.user.id, authCtx.workspaceId);

    const res = await mod.approveCandidate(cand!.id, ids.doc);
    expect(res.ok).toBe(true);

    const brags = await db.select().from(schema.brag).where(eq(schema.brag.documentId, ids.doc));
    expect(brags).toHaveLength(1);
    expect(brags[0]!.title).toBe("Ship it");

    const links = await db
      .select()
      .from(schema.bragLink)
      .where(eq(schema.bragLink.bragId, brags[0]!.id));
    expect(links[0]!.url).toBe("https://github.com/acme/web/pull/9");

    const [after] = await db
      .select()
      .from(schema.importCandidate)
      .where(eq(schema.importCandidate.id, cand!.id));
    expect(after).toMatchObject({ status: "approved", bragId: brags[0]!.id });
    expect(await mod.listCandidates(authCtx.user.id, authCtx.workspaceId)).toHaveLength(0);
  });

  it("dismiss removes from the queue; disconnect drops the connection and its candidates", async () => {
    const { db, schema, eq } = mod;
    await seed("dismiss");
    await mod.connectPat({ provider: "github", token: "t" });
    stub.candidates = [pr("7")];
    await mod.importNow("github");
    const [cand] = await mod.listCandidates(authCtx.user.id, authCtx.workspaceId);

    expect(await mod.dismissCandidate(cand!.id)).toEqual({ ok: true });
    expect(await mod.listCandidates(authCtx.user.id, authCtx.workspaceId)).toHaveLength(0);
    expect(
      await mod.listCandidates(authCtx.user.id, authCtx.workspaceId, "dismissed"),
    ).toHaveLength(1);

    stub.revokeToken.mockClear();
    expect(await mod.disconnectProvider("github")).toEqual({ ok: true });
    expect(stub.revokeToken).not.toHaveBeenCalled(); // a pasted token is user-managed — nothing to revoke
    const conns = await db
      .select()
      .from(schema.integrationConnection)
      .where(eq(schema.integrationConnection.userId, authCtx.user.id));
    expect(conns).toHaveLength(0);
    const cands = await db
      .select()
      .from(schema.importCandidate)
      .where(eq(schema.importCandidate.userId, authCtx.user.id));
    expect(cands).toHaveLength(0); // cascaded with the connection
  });

  it("importNow refreshes an expiring OAuth token in place before fetching", async () => {
    const { db, schema, eq } = mod;
    const { encryptToken, decryptToken } = await import("./crypto");
    await seed("refresh");
    // An OAuth connection whose access token expired an hour ago (so a refresh is due).
    await db.insert(schema.integrationConnection).values({
      id: "intact-conn-refresh",
      userId: authCtx.user.id,
      workspaceId: authCtx.workspaceId,
      provider: "github",
      authType: "oauth",
      externalAccountId: "42",
      externalAccountLabel: "octocat",
      accessToken: encryptToken("stale_at"),
      refreshToken: encryptToken("the_rt"),
      accessTokenExpiresAt: new Date(Date.now() - 3600_000),
    });
    stub.candidates = [];
    stub.refreshTokens.mockClear();

    expect(await mod.importNow("github")).toEqual({ ok: true, imported: 0 });
    expect(stub.refreshTokens).toHaveBeenCalledWith("the_rt");

    const [row] = await db
      .select()
      .from(schema.integrationConnection)
      .where(eq(schema.integrationConnection.id, "intact-conn-refresh"));
    // the rotated token is persisted (encrypted) and the expiry moved into the future
    expect(decryptToken(row!.accessToken)).toBe("refreshed_at");
    expect(decryptToken(row!.refreshToken!)).toBe("refreshed_rt");
    expect(row!.accessTokenExpiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("disconnect best-effort revokes an OAuth token at the provider", async () => {
    const { db, schema } = mod;
    const { encryptToken } = await import("./crypto");
    await seed("revoke");
    await db.insert(schema.integrationConnection).values({
      id: "intact-conn-revoke",
      userId: authCtx.user.id,
      workspaceId: authCtx.workspaceId,
      provider: "github",
      authType: "oauth",
      externalAccountId: "42",
      externalAccountLabel: "octocat",
      accessToken: encryptToken("oauth_at"),
    });
    stub.revokeToken.mockClear();

    expect(await mod.disconnectProvider("github")).toEqual({ ok: true });
    expect(stub.revokeToken).toHaveBeenCalledWith("oauth_at");
  });
});

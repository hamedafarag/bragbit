// DB-gated integration tests for the connected-apps queries + revoke action.
// The security property: a user only ever sees and revokes their OWN OAuth
// grants — revoking is scoped to the caller's user id, so it can't touch another
// user's consent or tokens. Skipped unless DATABASE_URL is set (`pnpm test:db`).
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

const authCtx = vi.hoisted(() => ({ user: { id: "" } }));
vi.mock("@/lib/auth/guards", () => ({ requireSession: async () => authCtx }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

async function load() {
  const [dbMod, schema, drizzle, queries, actions] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db/schema"),
    import("drizzle-orm"),
    import("./queries"),
    import("./actions"),
  ]);
  return { db: dbMod.db, schema, eq: drizzle.eq, inArray: drizzle.inArray, ...queries, ...actions };
}

describe.skipIf(!hasDb)("connected apps", () => {
  let mod: Awaited<ReturnType<typeof load>>;
  const userIds: string[] = [];
  const clientIds: string[] = [];

  beforeAll(async () => {
    mod = await load();
  });

  async function seedUser(sfx: string) {
    const id = `oauthc-user-${sfx}`;
    await mod.db.insert(mod.schema.user).values({ id, name: "U", email: `${id}@t.local` });
    userIds.push(id);
    return id;
  }

  /**
   * A registered client plus a live token for `userId` — and, unless `withConsent`
   * is false, a consent row too. `withConsent: false` models the auto-approve grant
   * path (token issued, no consent row), which "Connected apps" must still surface.
   */
  async function seedGrant(sfx: string, userId: string, withConsent = true) {
    const { db, schema } = mod;
    const clientId = `oauthc-client-${sfx}`;
    await db.insert(schema.oauthApplication).values({
      id: `oauthc-app-${sfx}`,
      name: `App ${sfx}`,
      clientId,
      redirectUrls: "http://x/cb",
      type: "public",
    });
    if (withConsent) {
      await db.insert(schema.oauthConsent).values({
        id: `oauthc-consent-${sfx}`,
        clientId,
        userId,
        scopes: "openid brags:write",
        consentGiven: true,
      });
    }
    await db.insert(schema.oauthAccessToken).values({
      id: `oauthc-tok-${sfx}`,
      accessToken: `at-${sfx}`,
      refreshToken: `rt-${sfx}`,
      accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
      refreshTokenExpiresAt: new Date(Date.now() + 604_800_000),
      clientId,
      userId,
      scopes: "openid brags:write",
    });
    clientIds.push(clientId);
    return clientId;
  }

  afterEach(async () => {
    const { db, schema, inArray } = mod;
    if (clientIds.length)
      await db
        .delete(schema.oauthApplication)
        .where(inArray(schema.oauthApplication.clientId, clientIds));
    if (userIds.length) await db.delete(schema.user).where(inArray(schema.user.id, userIds));
    clientIds.length = 0;
    userIds.length = 0;
  });

  afterAll(async () => {
    await (
      globalThis as { __bragbitClient?: { end?: (o?: unknown) => Promise<void> } }
    ).__bragbitClient
      ?.end?.({ timeout: 5 })
      .catch(() => {});
  });

  it("listConnectedApps returns the user's authorized clients", async () => {
    const u = await seedUser("list");
    await seedGrant("list", u);
    const apps = await mod.listConnectedApps(u);
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({
      clientId: "oauthc-client-list",
      name: "App list",
      scopes: "openid brags:write",
    });
  });

  it("surfaces + revokes an auto-approved grant (token, no consent row)", async () => {
    const u = await seedUser("noconsent");
    const clientId = await seedGrant("noconsent", u, false); // token only
    authCtx.user.id = u;

    // token-based listing surfaces it even without a consent row
    expect((await mod.listConnectedApps(u)).map((a) => a.clientId)).toEqual([clientId]);
    // and revoke reaches it (keyed off the token, not consent)
    expect(await mod.revokeConnectedApp(clientId)).toEqual({ ok: true });
    expect(await mod.listConnectedApps(u)).toHaveLength(0);
  });

  it("revokeConnectedApp deletes the caller's consent + tokens", async () => {
    const { db, schema, eq } = mod;
    const u = await seedUser("revoke");
    const clientId = await seedGrant("revoke", u);
    authCtx.user.id = u;

    expect(await mod.revokeConnectedApp(clientId)).toEqual({ ok: true });
    expect(
      await db.select().from(schema.oauthConsent).where(eq(schema.oauthConsent.clientId, clientId)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(schema.oauthAccessToken)
        .where(eq(schema.oauthAccessToken.clientId, clientId)),
    ).toEqual([]);
    // second revoke → nothing to revoke
    expect((await mod.revokeConnectedApp(clientId)).ok).toBe(false);
  });

  it("revokeConnectedApp cannot touch another user's grant (isolation)", async () => {
    const owner = await seedUser("owner");
    const other = await seedUser("other");
    const clientId = await seedGrant("shared", owner);

    authCtx.user.id = other; // a different user attempts the revoke
    expect((await mod.revokeConnectedApp(clientId)).ok).toBe(false);
    // the owner's consent survives untouched
    expect(await mod.listConnectedApps(owner)).toHaveLength(1);
  });
});

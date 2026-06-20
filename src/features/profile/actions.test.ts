// DB-gated integration tests for the profile action (ENH-TEST L2-6). updateProfile
// upserts the caller's profile and mirrors the display name onto user.name; both
// run against real Postgres behind a mocked requireSession. Skipped unless
// DATABASE_URL is set.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

const authCtx = vi.hoisted(() => ({ user: { id: "" } }));
vi.mock("@/lib/auth/guards", () => ({ requireSession: async () => authCtx }));

async function load() {
  const [dbMod, schema, drizzle, actions] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db/schema"),
    import("drizzle-orm"),
    import("@/features/profile/actions"),
  ]);
  return { db: dbMod.db, schema, eq: drizzle.eq, inArray: drizzle.inArray, ...actions };
}

describe.skipIf(!hasDb)("updateProfile", () => {
  let mod: Awaited<ReturnType<typeof load>>;
  const userIds: string[] = [];

  beforeAll(async () => {
    mod = await load();
  });

  async function seedUser(sfx: string) {
    const { db, schema } = mod;
    const id = `profact-user-${sfx}`;
    await db.insert(schema.user).values({ id, name: "Old Name", email: `${id}@t.local` });
    userIds.push(id);
    authCtx.user.id = id;
    return id;
  }

  afterEach(async () => {
    const { db, schema, inArray } = mod;
    if (userIds.length) await db.delete(schema.user).where(inArray(schema.user.id, userIds));
    userIds.length = 0;
  });

  afterAll(async () => {
    await (
      globalThis as { __bragbitClient?: { end?: (o?: unknown) => Promise<void> } }
    ).__bragbitClient
      ?.end?.({ timeout: 5 })
      .catch(() => {});
  });

  it("creates the profile, maps empty optionals to null, and mirrors the name", async () => {
    const { db, schema, eq } = mod;
    const id = await seedUser("create");

    expect(
      await mod.updateProfile({
        displayName: "Ada Lovelace",
        roleTitle: "Staff Eng",
        team: "",
        bio: "",
      }),
    ).toEqual({ ok: true });

    const [p] = await db.select().from(schema.profile).where(eq(schema.profile.userId, id));
    expect(p).toMatchObject({
      displayName: "Ada Lovelace",
      roleTitle: "Staff Eng",
      team: null,
      bio: null,
    });
    const [u] = await db
      .select({ name: schema.user.name })
      .from(schema.user)
      .where(eq(schema.user.id, id));
    expect(u.name).toBe("Ada Lovelace"); // mirrored to user.name

    expect(
      (await mod.updateProfile({ displayName: "", roleTitle: "", team: "", bio: "" })).ok,
    ).toBe(false);
  });

  it("upserts on a second save (one profile row, updated)", async () => {
    const { db, schema, eq } = mod;
    const id = await seedUser("upsert");

    await mod.updateProfile({ displayName: "First", roleTitle: "", team: "", bio: "" });
    await mod.updateProfile({
      displayName: "Second",
      roleTitle: "Lead",
      team: "Platform",
      bio: "hi",
    });

    const rows = await db.select().from(schema.profile).where(eq(schema.profile.userId, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ displayName: "Second", roleTitle: "Lead", team: "Platform" });
  });
});

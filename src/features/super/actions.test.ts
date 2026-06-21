// DB-gated test for the /super actions (suspend workspaces/users, set quotas).
// requireSuperadmin is mocked; the Drizzle writes run against real Postgres.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

vi.mock("@/lib/auth/guards", () => ({
  requireSuperadmin: async () => ({ user: { id: "super", email: "super@x.local" } }),
}));

async function load() {
  const [dbMod, schema, drizzle, actions] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db/schema"),
    import("drizzle-orm"),
    import("@/features/super/actions"),
  ]);
  return { db: dbMod.db, schema, eq: drizzle.eq, inArray: drizzle.inArray, ...actions };
}

describe.skipIf(!hasDb)("super actions", () => {
  let mod: Awaited<ReturnType<typeof load>>;
  const orgIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    mod = await load();
  });

  async function seed() {
    const { db, schema } = mod;
    await db.insert(schema.user).values({ id: "sa-user", name: "U", email: "sa-user@t.local" });
    await db
      .insert(schema.organization)
      .values({ id: "sa-org", name: "Acme", slug: "sa-org", type: "organization" });
    userIds.push("sa-user");
    orgIds.push("sa-org");
  }

  afterEach(async () => {
    const { db, schema, inArray } = mod;
    if (userIds.length) await db.delete(schema.user).where(inArray(schema.user.id, userIds));
    if (orgIds.length)
      await db.delete(schema.organization).where(inArray(schema.organization.id, orgIds));
    userIds.length = 0;
    orgIds.length = 0;
  });

  afterAll(async () => {
    await (
      globalThis as { __bragbitClient?: { end?: (o?: unknown) => Promise<void> } }
    ).__bragbitClient
      ?.end?.({ timeout: 5 })
      .catch(() => {});
  });

  it("setWorkspaceSuspended stamps then clears suspendedAt", async () => {
    const { db, schema, eq } = mod;
    await seed();

    expect(await mod.setWorkspaceSuspended("sa-org", true)).toEqual({ ok: true });
    let [org] = await db
      .select()
      .from(schema.organization)
      .where(eq(schema.organization.id, "sa-org"));
    expect(org!.suspendedAt).toBeInstanceOf(Date);

    expect(await mod.setWorkspaceSuspended("sa-org", false)).toEqual({ ok: true });
    [org] = await db.select().from(schema.organization).where(eq(schema.organization.id, "sa-org"));
    expect(org!.suspendedAt).toBeNull();
  });

  it("setUserSuspended stamps then clears suspendedAt", async () => {
    const { db, schema, eq } = mod;
    await seed();

    expect(await mod.setUserSuspended("sa-user", true)).toEqual({ ok: true });
    let [u] = await db.select().from(schema.user).where(eq(schema.user.id, "sa-user"));
    expect(u!.suspendedAt).toBeInstanceOf(Date);

    expect(await mod.setUserSuspended("sa-user", false)).toEqual({ ok: true });
    [u] = await db.select().from(schema.user).where(eq(schema.user.id, "sa-user"));
    expect(u!.suspendedAt).toBeNull();
  });

  it("setWorkspaceQuota sets a positive value, clears with null, and rejects bad input", async () => {
    const { db, schema, eq } = mod;
    await seed();

    expect(await mod.setWorkspaceQuota("sa-org", 1024)).toEqual({ ok: true });
    let [org] = await db
      .select()
      .from(schema.organization)
      .where(eq(schema.organization.id, "sa-org"));
    expect(org!.storageQuotaMb).toBe(1024);

    expect(await mod.setWorkspaceQuota("sa-org", null)).toEqual({ ok: true });
    [org] = await db.select().from(schema.organization).where(eq(schema.organization.id, "sa-org"));
    expect(org!.storageQuotaMb).toBeNull();

    expect((await mod.setWorkspaceQuota("sa-org", -5)).ok).toBe(false);
    expect((await mod.setWorkspaceQuota("sa-org", 1.5)).ok).toBe(false);
  });
});

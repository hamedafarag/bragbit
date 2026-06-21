// DB-gated test for listUserWorkspaces (the data behind the header switcher). Mocks
// the DAL guard; seeds a user with a personal + an org membership (plus another
// user's org) and asserts the list, ordering, role, the active flag, and isolation.
// Skipped unless DATABASE_URL is set.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

const authCtx = vi.hoisted(() => ({ workspaceId: "", user: { id: "" } }));
vi.mock("@/lib/auth/guards", () => ({ requireWorkspace: async () => authCtx }));

async function load() {
  const [dbMod, schema, drizzle, queries] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db/schema"),
    import("drizzle-orm"),
    import("@/features/workspace/queries"),
  ]);
  return { db: dbMod.db, schema, inArray: drizzle.inArray, ...queries };
}

describe.skipIf(!hasDb)("listUserWorkspaces", () => {
  let mod: Awaited<ReturnType<typeof load>>;
  const orgIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    mod = await load();
  });

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

  it("lists the caller's workspaces (personal first) with role + active flag; excludes others'", async () => {
    const { db, schema } = mod;
    await db.insert(schema.user).values([
      { id: "lw-user", name: "U", email: "lw-user@t.local" },
      { id: "lw-other", name: "O", email: "lw-other@t.local" },
    ]);
    userIds.push("lw-user", "lw-other");
    await db.insert(schema.organization).values([
      { id: "lw-personal", name: "My Logbook", slug: "lw-personal", type: "personal" },
      { id: "lw-acme", name: "Acme", slug: "lw-acme", type: "organization" },
      { id: "lw-other-org", name: "Other Co", slug: "lw-other-org", type: "organization" },
    ]);
    orgIds.push("lw-personal", "lw-acme", "lw-other-org");
    await db.insert(schema.member).values([
      { id: "lw-m1", organizationId: "lw-personal", userId: "lw-user", role: "owner" },
      { id: "lw-m2", organizationId: "lw-acme", userId: "lw-user", role: "admin" },
      { id: "lw-m3", organizationId: "lw-other-org", userId: "lw-other", role: "owner" },
    ]);

    authCtx.user.id = "lw-user";
    authCtx.workspaceId = "lw-acme"; // the active one

    const list = await mod.listUserWorkspaces();
    expect(list.map((w) => w.id)).toEqual(["lw-personal", "lw-acme"]); // personal first; other user's absent
    expect(list.find((w) => w.id === "lw-personal")).toMatchObject({
      type: "personal",
      role: "owner",
      isActive: false,
    });
    expect(list.find((w) => w.id === "lw-acme")).toMatchObject({
      type: "organization",
      role: "admin",
      isActive: true,
    });
  });
});

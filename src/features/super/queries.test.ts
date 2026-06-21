// DB-gated test for the /super queries — the security-critical constraint is that
// they return ONLY workspace/user metadata, NEVER brag content (PLAN §10). We seed a
// workspace WITH a document + a brag bearing a distinctive marker, then assert the
// marker never appears anywhere in the super output. requireSuperadmin is mocked.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

vi.mock("@/lib/auth/guards", () => ({
  requireSuperadmin: async () => ({ user: { id: "super", email: "super@x.local" } }),
}));

async function load() {
  const [dbMod, schema, drizzle, queries] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db/schema"),
    import("drizzle-orm"),
    import("@/features/super/queries"),
  ]);
  return { db: dbMod.db, schema, inArray: drizzle.inArray, ...queries };
}

const MARKER = "topsecretbragcontent";

describe.skipIf(!hasDb)("super queries", () => {
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

  it("return metadata only (member count, suspension, quota) and NEVER brag content", async () => {
    const { db, schema } = mod;
    await db.insert(schema.user).values({ id: "sq-user", name: "Owner", email: "sq-user@t.local" });
    userIds.push("sq-user");
    await db.insert(schema.organization).values({
      id: "sq-org",
      name: "Acme",
      slug: "sq-org",
      type: "organization",
      storageQuotaMb: 500,
    });
    orgIds.push("sq-org");
    await db
      .insert(schema.member)
      .values({ id: "sq-mem", organizationId: "sq-org", userId: "sq-user", role: "owner" });
    // Content the superadmin must NEVER see — the marker lives only in the doc/brag.
    await db
      .insert(schema.document)
      .values({ id: "sq-doc", workspaceId: "sq-org", userId: "sq-user", title: MARKER });
    await db
      .insert(schema.brag)
      .values({ id: "sq-brag", documentId: "sq-doc", title: MARKER, descriptionMd: MARKER });

    const workspaces = await mod.listWorkspacesForSuper();
    const ws = workspaces.find((w) => w.id === "sq-org");
    expect(ws).toMatchObject({
      name: "Acme",
      type: "organization",
      memberCount: 1,
      storageQuotaMb: 500,
      suspendedAt: null,
    });

    const users = await mod.listUsersForSuper();
    expect(users.find((u) => u.id === "sq-user")).toMatchObject({
      email: "sq-user@t.local",
      suspendedAt: null,
    });

    // The brag/document marker must appear NOWHERE in the super output.
    expect(JSON.stringify({ workspaces, users })).not.toContain(MARKER);
  });
});

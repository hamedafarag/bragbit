// DB-gated tests for personal-workspace provisioning (PLAN §10 — open signup). The
// core (`provisionPersonalWorkspace`) creates the org(personal) + owner membership;
// the hook wrapper (`provisionPersonalWorkspaceOnSignUp`) gates on `isHosted()`,
// which is mocked here so both branches run. Skipped unless DATABASE_URL is set
// (importing @/lib/db → @/lib/env throws without it — hence the lazy imports).
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

const inst = vi.hoisted(() => ({ hosted: true }));
vi.mock("@/lib/instance", () => ({ isHosted: () => inst.hosted }));

async function load() {
  const [dbMod, schema, drizzle, prov] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db/schema"),
    import("drizzle-orm"),
    import("@/features/workspace/provisioning"),
  ]);
  return { db: dbMod.db, schema, eq: drizzle.eq, inArray: drizzle.inArray, ...prov };
}

describe.skipIf(!hasDb)("personal workspace provisioning", () => {
  let mod: Awaited<ReturnType<typeof load>>;
  const userIds: string[] = [];
  const orgIds: string[] = [];

  beforeAll(async () => {
    mod = await load();
  });

  async function seedUser(sfx: string, name: string) {
    const id = `prov-user-${sfx}`;
    await mod.db.insert(mod.schema.user).values({ id, name, email: `${id}@iso.local` });
    userIds.push(id);
    return id;
  }

  afterEach(async () => {
    const { db, schema, inArray } = mod;
    if (orgIds.length)
      await db.delete(schema.organization).where(inArray(schema.organization.id, orgIds));
    if (userIds.length) await db.delete(schema.user).where(inArray(schema.user.id, userIds));
    orgIds.length = 0;
    userIds.length = 0;
    inst.hosted = true;
  });

  afterAll(async () => {
    await (
      globalThis as { __bragbitClient?: { end?: (o?: unknown) => Promise<void> } }
    ).__bragbitClient
      ?.end?.({ timeout: 5 })
      .catch(() => {});
  });

  it("personalWorkspaceName uses the first name, with a fallback", () => {
    expect(mod.personalWorkspaceName("Riley Chen")).toBe("Riley's Logbook");
    expect(mod.personalWorkspaceName("   ")).toBe("Personal Logbook");
    expect(mod.personalWorkspaceName(null)).toBe("Personal Logbook");
  });

  it("provisionPersonalWorkspace creates a personal org + an owner membership", async () => {
    const { db, schema, eq } = mod;
    const uid = await seedUser("core", "Ada Lovelace");

    const orgId = await mod.provisionPersonalWorkspace({ id: uid, name: "Ada Lovelace" });
    orgIds.push(orgId);

    const [org] = await db
      .select()
      .from(schema.organization)
      .where(eq(schema.organization.id, orgId));
    expect(org).toMatchObject({ type: "personal", name: "Ada's Logbook" });
    expect(org!.slug).toBe(`personal-${orgId}`);
    expect(org!.accentColor).toBeNull(); // personal → instance-default branding

    const members = await db
      .select()
      .from(schema.member)
      .where(eq(schema.member.organizationId, orgId));
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ userId: uid, role: "owner" });
  });

  it("provisionPersonalWorkspaceOnSignUp provisions on hosted, no-ops in private modes", async () => {
    const { db, schema, eq } = mod;

    // Hosted → a personal workspace appears.
    inst.hosted = true;
    const hostedUid = await seedUser("hosted", "Grace Hopper");
    await mod.provisionPersonalWorkspaceOnSignUp({ id: hostedUid, name: "Grace Hopper" });
    const hostedMemberships = await db
      .select()
      .from(schema.member)
      .where(eq(schema.member.userId, hostedUid));
    expect(hostedMemberships).toHaveLength(1);
    orgIds.push(hostedMemberships[0]!.organizationId);

    // Private mode → nothing is provisioned (setup/invite do it explicitly).
    inst.hosted = false;
    const privateUid = await seedUser("private", "Alan Turing");
    await mod.provisionPersonalWorkspaceOnSignUp({ id: privateUid, name: "Alan Turing" });
    const privateMemberships = await db
      .select()
      .from(schema.member)
      .where(eq(schema.member.userId, privateUid));
    expect(privateMemberships).toHaveLength(0);
  });
});

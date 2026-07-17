// DB-gated integration tests for the MCP service (the explicit-scope data layer
// behind the tools). The security-critical property: the workspace is derived
// from the target document, so a token/user can only add to — and list — their
// OWN documents, never another user's or tenant's. Skipped unless DATABASE_URL is
// set (run with `pnpm test:db`).
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

async function load() {
  const [dbMod, schema, drizzle, service] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db/schema"),
    import("drizzle-orm"),
    import("./service"),
  ]);
  return { db: dbMod.db, schema, eq: drizzle.eq, inArray: drizzle.inArray, ...service };
}

describe.skipIf(!hasDb)("mcp service", () => {
  let mod: Awaited<ReturnType<typeof load>>;
  const orgIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    mod = await load();
  });

  /** Seed an org, a member user, and a non-archived document they own. */
  async function seed(sfx: string) {
    const { db, schema } = mod;
    const ids = { org: `mcpsvc-org-${sfx}`, user: `mcpsvc-user-${sfx}`, doc: `mcpsvc-doc-${sfx}` };
    await db.insert(schema.organization).values({ id: ids.org, name: `WS ${sfx}`, slug: ids.org });
    await db.insert(schema.user).values({ id: ids.user, name: "U", email: `${ids.user}@t.local` });
    await db.insert(schema.member).values({
      id: `mcpsvc-mem-${sfx}`,
      organizationId: ids.org,
      userId: ids.user,
      role: "owner",
    });
    await db.insert(schema.document).values({
      id: ids.doc,
      workspaceId: ids.org,
      userId: ids.user,
      title: `Doc ${sfx}`,
    });
    orgIds.push(ids.org);
    userIds.push(ids.user);
    return ids;
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

  it("addBragForUser writes to the user's document (explicit id) with links", async () => {
    const { db, schema, eq } = mod;
    const s = await seed("add");

    const res = await mod.addBragForUser(s.user, {
      title: "Shipped X",
      documentId: s.doc,
      impact: "cut time 22→5m",
      category: "shipped-work",
      links: [{ url: "https://x/pr/1", label: "PR" }],
    });
    expect(res.ok).toBe(true);
    const id = res.ok ? res.id : "";

    const [b] = await db.select().from(schema.brag).where(eq(schema.brag.id, id));
    expect(b).toMatchObject({
      title: "Shipped X",
      documentId: s.doc,
      category: "shipped-work",
      impactMd: "cut time 22→5m",
    });
    const links = await db.select().from(schema.bragLink).where(eq(schema.bragLink.bragId, id));
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ url: "https://x/pr/1", label: "PR", position: 0 });
  });

  it("addBragForUser defaults to the most-recent document when none is given", async () => {
    const s = await seed("default");
    const res = await mod.addBragForUser(s.user, { title: "No doc id" });
    expect(res.ok && res.documentId).toBe(s.doc);
  });

  it("addBragForUser refuses a document owned by another user (isolation)", async () => {
    const owner = await seed("owner");
    const intruder = await seed("intruder");
    const res = await mod.addBragForUser(intruder.user, { title: "Hijack", documentId: owner.doc });
    expect(res.ok).toBe(false);
    // owner's document gained no brag
    const { db, schema, eq } = mod;
    const rows = await db.select().from(schema.brag).where(eq(schema.brag.documentId, owner.doc));
    expect(rows).toHaveLength(0);
  });

  it("addBragForUser errors when the user has no documents", async () => {
    const { db, schema, eq } = mod;
    const s = await seed("empty");
    await db.delete(schema.document).where(eq(schema.document.id, s.doc));
    expect((await mod.addBragForUser(s.user, { title: "orphan" })).ok).toBe(false);
  });

  it("listDocumentsForUser returns only the caller's documents", async () => {
    const a = await seed("list-a");
    const b = await seed("list-b");
    expect((await mod.listDocumentsForUser(a.user)).map((d) => d.id)).toEqual([a.doc]);
    expect((await mod.listDocumentsForUser(b.user)).map((d) => d.id)).toEqual([b.doc]);
  });
});

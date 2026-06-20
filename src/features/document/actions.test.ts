// DB-gated integration tests for the document server actions (ENH-TEST L2-4).
// Pure Drizzle behind requireWorkspace, so these run the real create/update/
// archive paths against Postgres and assert ownership scoping (a mismatched
// workspace/user matches no row → not-found). deleteDocument is covered in
// attachment/object-cleanup.test.ts. Skipped unless DATABASE_URL is set.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

const authCtx = vi.hoisted(() => ({ workspaceId: "", user: { id: "" } }));
vi.mock("@/lib/auth/guards", () => ({ requireWorkspace: async () => authCtx }));

async function load() {
  const [dbMod, schema, drizzle, actions] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db/schema"),
    import("drizzle-orm"),
    import("@/features/document/actions"),
  ]);
  return { db: dbMod.db, schema, eq: drizzle.eq, inArray: drizzle.inArray, ...actions };
}

const DOC = {
  title: "2026",
  description: "The year of shipping",
  periodStart: "2026-01-01",
  periodEnd: "2026-12-31",
  goalsMd: "Ship things",
};

describe.skipIf(!hasDb)("document server actions", () => {
  let mod: Awaited<ReturnType<typeof load>>;
  const orgIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    mod = await load();
  });

  async function seed(sfx: string) {
    const { db, schema } = mod;
    const ids = { org: `docact-org-${sfx}`, user: `docact-user-${sfx}` };
    await db.insert(schema.organization).values({ id: ids.org, name: `Doc ${sfx}`, slug: ids.org });
    await db.insert(schema.user).values({ id: ids.user, name: "U", email: `${ids.user}@t.local` });
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
  });

  afterAll(async () => {
    await (
      globalThis as { __bragbitClient?: { end?: (o?: unknown) => Promise<void> } }
    ).__bragbitClient
      ?.end?.({ timeout: 5 })
      .catch(() => {});
  });

  it("createDocument inserts a caller-owned row (empty optionals → null); rejects bad input", async () => {
    const { db, schema, eq } = mod;
    await seed("create");

    const res = await mod.createDocument({ ...DOC, description: "", goalsMd: "" });
    expect(res.ok).toBe(true);
    const id = res.ok ? res.id : "";
    const [row] = await db.select().from(schema.document).where(eq(schema.document.id, id));
    expect(row).toMatchObject({
      title: "2026",
      description: null, // "" mapped to null
      goalsMd: null,
      workspaceId: authCtx.workspaceId,
      userId: authCtx.user.id,
    });

    expect((await mod.createDocument({ ...DOC, title: "" })).ok).toBe(false);
  });

  it("updateDocument changes fields it owns and 404s another user's doc", async () => {
    const { db, schema, eq } = mod;
    const s = await seed("update");
    const created = await mod.createDocument(DOC);
    const id = created.ok ? created.id : "";

    expect(await mod.updateDocument(id, { ...DOC, title: "Renamed" })).toEqual({ ok: true });
    const [row] = await db
      .select({ title: schema.document.title })
      .from(schema.document)
      .where(eq(schema.document.id, id));
    expect(row.title).toBe("Renamed");

    // a different caller in the same workspace can't update it
    authCtx.user.id = `${s.user}-other`;
    expect(await mod.updateDocument(id, { ...DOC, title: "Hijack" })).toEqual({
      ok: false,
      error: "Document not found.",
    });
  });

  it("archive/unarchive toggles archivedAt for an owned doc", async () => {
    const { db, schema, eq } = mod;
    await seed("archive");
    const created = await mod.createDocument(DOC);
    const id = created.ok ? created.id : "";

    expect(await mod.archiveDocument(id)).toEqual({ ok: true });
    let [row] = await db
      .select({ a: schema.document.archivedAt })
      .from(schema.document)
      .where(eq(schema.document.id, id));
    expect(row.a).not.toBeNull();

    expect(await mod.unarchiveDocument(id)).toEqual({ ok: true });
    [row] = await db
      .select({ a: schema.document.archivedAt })
      .from(schema.document)
      .where(eq(schema.document.id, id));
    expect(row.a).toBeNull();

    expect(await mod.archiveDocument("nope")).toEqual({ ok: false, error: "Document not found." });
  });
});

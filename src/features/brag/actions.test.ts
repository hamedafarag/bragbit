// DB-gated integration tests for the brag server actions (ENH-TEST L2-5). Pure
// Drizzle behind requireWorkspace — exercises quick-add, the full create/update
// transactions (links + the create-or-find tag sync), ownership scoping, and tag
// suggestions against real Postgres. deleteBrag is covered in object-cleanup.
// Skipped unless DATABASE_URL is set.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

const authCtx = vi.hoisted(() => ({ workspaceId: "", user: { id: "" } }));
vi.mock("@/lib/auth/guards", () => ({ requireWorkspace: async () => authCtx }));

async function load() {
  const [dbMod, schema, drizzle, actions] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db/schema"),
    import("drizzle-orm"),
    import("@/features/brag/actions"),
  ]);
  return {
    db: dbMod.db,
    schema,
    eq: drizzle.eq,
    and: drizzle.and,
    inArray: drizzle.inArray,
    ...actions,
  };
}

const BRAG = {
  title: "Shipped the heatmap",
  date: "2026-03-01",
  category: "shipped-work" as const,
  status: "shipped" as const,
  descriptionMd: "did the thing",
  impactMd: "big impact",
  collaborators: "Ada, Grace",
  attribution: "",
  links: [{ url: "https://example.com/pr/1", label: "PR #1" }],
  tags: ["alpha", "beta"],
  visibility: "shared" as const,
};

describe.skipIf(!hasDb)("brag server actions", () => {
  let mod: Awaited<ReturnType<typeof load>>;
  const orgIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    mod = await load();
  });

  /** Seed an org, the caller, and a document they own. */
  async function seed(sfx: string) {
    const { db, schema } = mod;
    const ids = {
      org: `bragact-org-${sfx}`,
      user: `bragact-user-${sfx}`,
      doc: `bragact-doc-${sfx}`,
    };
    await db
      .insert(schema.organization)
      .values({ id: ids.org, name: `Brag ${sfx}`, slug: ids.org });
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
  });

  afterAll(async () => {
    await (
      globalThis as { __bragbitClient?: { end?: (o?: unknown) => Promise<void> } }
    ).__bragbitClient
      ?.end?.({ timeout: 5 })
      .catch(() => {});
  });

  it("quickAddBrag inserts a title-only brag; rejects empty + an unowned document", async () => {
    const { db, schema, eq } = mod;
    const s = await seed("quick");

    const res = await mod.quickAddBrag(s.doc, { title: "A quick win", date: "2026-06-01" });
    expect(res.ok).toBe(true);
    const id = res.ok ? res.id : "";
    const [row] = await db.select().from(schema.brag).where(eq(schema.brag.id, id));
    expect(row).toMatchObject({ title: "A quick win", documentId: s.doc });

    expect((await mod.quickAddBrag(s.doc, { title: "", date: "2026-06-01" })).ok).toBe(false);
    // a document the caller doesn't own
    authCtx.user.id = `${s.user}-other`;
    expect(await mod.quickAddBrag(s.doc, { title: "X", date: "2026-06-01" })).toEqual({
      ok: false,
      error: "Document not found.",
    });
  });

  it("createBrag persists fields, links, and create-or-found tags", async () => {
    const { db, schema, eq, and } = mod;
    const s = await seed("create");

    const res = await mod.createBrag(s.doc, BRAG);
    expect(res.ok).toBe(true);
    const id = res.ok ? res.id : "";

    const [b] = await db.select().from(schema.brag).where(eq(schema.brag.id, id));
    expect(b).toMatchObject({
      title: BRAG.title,
      collaborators: ["Ada", "Grace"],
      visibility: "shared",
    });

    const links = await db.select().from(schema.bragLink).where(eq(schema.bragLink.bragId, id));
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      url: "https://example.com/pr/1",
      label: "PR #1",
      position: 0,
    });

    const tags = await db
      .select({ name: schema.tag.name })
      .from(schema.tag)
      .where(and(eq(schema.tag.userId, s.user), eq(schema.tag.workspaceId, s.org)));
    expect(tags.map((t) => t.name).sort()).toEqual(["alpha", "beta"]);
    const bragTags = await db.select().from(schema.bragTag).where(eq(schema.bragTag.bragId, id));
    expect(bragTags).toHaveLength(2);
  });

  it("updateBrag replaces fields/links/tags it owns, and 404s an unowned brag", async () => {
    const { db, schema, eq } = mod;
    const s = await seed("update");
    const created = await mod.createBrag(s.doc, BRAG);
    const id = created.ok ? created.id : "";

    expect(
      await mod.updateBrag(id, { ...BRAG, title: "Edited", links: [], tags: ["gamma"] }),
    ).toEqual({ ok: true });
    const [b] = await db.select().from(schema.brag).where(eq(schema.brag.id, id));
    expect(b.title).toBe("Edited");
    expect(await db.select().from(schema.bragLink).where(eq(schema.bragLink.bragId, id))).toEqual(
      [],
    );
    const bragTags = await db.select().from(schema.bragTag).where(eq(schema.bragTag.bragId, id));
    expect(bragTags).toHaveLength(1); // tags replaced wholesale

    authCtx.user.id = `${s.user}-other`;
    expect(await mod.updateBrag(id, { ...BRAG, title: "Hijack" })).toEqual({
      ok: false,
      error: "Brag not found.",
    });
  });

  it("getTagSuggestions returns only the caller's tags, sorted", async () => {
    const { db, schema } = mod;
    const s = await seed("tags");
    // caller's tags via a brag
    await mod.createBrag(s.doc, { ...BRAG, tags: ["zeta", "alpha"] });
    // another user's tag in the same workspace must not leak
    await db
      .insert(schema.user)
      .values({ id: `${s.user}-2`, name: "U2", email: `${s.user}-2@t.local` });
    userIds.push(`${s.user}-2`);
    await db
      .insert(schema.tag)
      .values({ userId: `${s.user}-2`, workspaceId: s.org, name: "secret" });

    expect(await mod.getTagSuggestions()).toEqual(["alpha", "zeta"]);
  });
});

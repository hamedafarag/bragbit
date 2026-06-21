// DB-gated integration test for the dashboard activity query (ENH-UX-05). Pure
// Drizzle behind requireWorkspace — exercises the per-day grouping, the `since`
// lower bound, and owner scoping against real Postgres. Seeds wins via the
// brag quick-add action. Skipped unless DATABASE_URL is set.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

const authCtx = vi.hoisted(() => ({ workspaceId: "", user: { id: "" } }));
vi.mock("@/lib/auth/guards", () => ({ requireWorkspace: async () => authCtx }));

async function load() {
  const [dbMod, schema, drizzle, queries, bragActions] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db/schema"),
    import("drizzle-orm"),
    import("@/features/dashboard/queries"),
    import("@/features/brag/actions"),
  ]);
  return {
    db: dbMod.db,
    schema,
    inArray: drizzle.inArray,
    getActivityCounts: queries.getActivityCounts,
    quickAddBrag: bragActions.quickAddBrag,
  };
}

describe.skipIf(!hasDb)("getActivityCounts", () => {
  let mod: Awaited<ReturnType<typeof load>>;
  const orgIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    mod = await load();
  });

  /** Seed an org, the caller, and a document they own; point authCtx at them. */
  async function seed(sfx: string) {
    const { db, schema } = mod;
    const ids = { org: `act-org-${sfx}`, user: `act-user-${sfx}`, doc: `act-doc-${sfx}` };
    await db.insert(schema.organization).values({ id: ids.org, name: `Act ${sfx}`, slug: ids.org });
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

  it("groups the caller's wins by day, from `since` onward", async () => {
    const s = await seed("counts");
    await mod.quickAddBrag(s.doc, { title: "a", date: "2026-03-01" });
    await mod.quickAddBrag(s.doc, { title: "b", date: "2026-03-01" });
    await mod.quickAddBrag(s.doc, { title: "c", date: "2026-03-03" });
    await mod.quickAddBrag(s.doc, { title: "old", date: "2026-01-01" }); // before the window

    const rows = await mod.getActivityCounts("2026-02-01");
    const byDate = Object.fromEntries(rows.map((r) => [r.date, r.count]));
    expect(byDate["2026-03-01"]).toBe(2);
    expect(byDate["2026-03-03"]).toBe(1);
    expect(byDate["2026-01-01"]).toBeUndefined(); // excluded by `since`
  });

  it("excludes another user's brags in the same workspace", async () => {
    const s = await seed("scope");
    await mod.quickAddBrag(s.doc, { title: "mine", date: "2026-03-05" });

    const { db, schema } = mod;
    await db
      .insert(schema.user)
      .values({ id: `${s.user}-2`, name: "U2", email: `${s.user}-2@t.local` });
    userIds.push(`${s.user}-2`);
    await db
      .insert(schema.document)
      .values({ id: `${s.doc}-2`, workspaceId: s.org, userId: `${s.user}-2`, title: "Doc2" });
    authCtx.user.id = `${s.user}-2`;
    await mod.quickAddBrag(`${s.doc}-2`, { title: "theirs", date: "2026-03-05" });
    authCtx.user.id = s.user; // back to the original caller

    const rows = await mod.getActivityCounts("2026-02-01");
    const byDate = Object.fromEntries(rows.map((r) => [r.date, r.count]));
    expect(byDate["2026-03-05"]).toBe(1); // only the caller's own win
  });
});

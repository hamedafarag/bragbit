// DB-gated integration tests for the timeline cursor pagination (PERF-01).
// `listBragsPage` windows a document's brags by whole months (newest first) until
// ~TIMELINE_PAGE_TARGET, always stopping on a month edge. Exercised against real
// Postgres behind a mocked requireWorkspace; skipped unless DATABASE_URL is set.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

const authCtx = vi.hoisted(() => ({ workspaceId: "", user: { id: "" } }));
vi.mock("@/lib/auth/guards", () => ({ requireWorkspace: async () => authCtx }));

async function load() {
  const [dbMod, schema, drizzle, queries, actions] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db/schema"),
    import("drizzle-orm"),
    import("@/features/brag/queries"),
    import("@/features/timeline/actions"),
  ]);
  return {
    db: dbMod.db,
    schema,
    eq: drizzle.eq,
    inArray: drizzle.inArray,
    ...queries,
    loadMoreTimeline: actions.loadMoreTimeline,
  };
}

describe.skipIf(!hasDb)("listBragsPage (timeline cursor pagination)", () => {
  let mod: Awaited<ReturnType<typeof load>>;
  const orgIds: string[] = [];
  const userIds: string[] = [];
  // Strictly-decreasing createdAt per brag, so date+createdAt ordering is fully
  // deterministic — listBrags and the paged reads then agree exactly on ties.
  let seq = 0;
  const base = new Date("2026-06-20T12:00:00Z").getTime();

  beforeAll(async () => {
    mod = await load();
  });

  /** Seed an org, the caller, and a document they own; point the guard at them. */
  async function seed(sfx: string) {
    const { db, schema } = mod;
    const ids = { org: `bragpg-org-${sfx}`, user: `bragpg-user-${sfx}`, doc: `bragpg-doc-${sfx}` };
    await db.insert(schema.organization).values({ id: ids.org, name: `Pg ${sfx}`, slug: ids.org });
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

  /** Insert brags for a document: each spec is [month "YYYY-MM", count, category?]. */
  async function insertBrags(docId: string, specs: [string, number, string?][]) {
    const rows = specs.flatMap(([month, n, category]) =>
      Array.from({ length: n }, () => {
        const k = seq++;
        return {
          id: `${docId}-b${k}`,
          documentId: docId,
          title: `Win ${month} #${k}`,
          date: `${month}-15`,
          category: category ?? null,
          createdAt: new Date(base - k * 1000),
        };
      }),
    );
    await mod.db.insert(mod.schema.brag).values(rows);
  }

  /** Walk every page from the first, returning the id sequence and per-page sizes. */
  async function drain(docId: string, filters: Record<string, string> = {}) {
    const ids: string[] = [];
    const sizes: number[] = [];
    let cursor: string | undefined;
    for (let guard = 0; guard < 50; guard++) {
      const page = await mod.listBragsPage(docId, filters, cursor);
      ids.push(...page.brags.map((b) => b.id));
      sizes.push(page.brags.length);
      if (!page.hasMore || !page.nextCursor) break;
      cursor = page.nextCursor;
    }
    return { ids, sizes };
  }

  const months = (page: { brags: { date: string }[] }) =>
    [...new Set(page.brags.map((b) => b.date.slice(0, 7)))].sort();

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

  it("returns everything in one page when the document is under the target", async () => {
    const s = await seed("small");
    await insertBrags(s.doc, [["2026-06", 5]]);

    const page = await mod.listBragsPage(s.doc);
    expect(page.brags).toHaveLength(5);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it("stops on a month boundary and the cursor chain equals listBrags exactly", async () => {
    const s = await seed("chain");
    // 16 + 16 fills page one (≥30, whole months); 8 in an older month spill over.
    await insertBrags(s.doc, [
      ["2026-06", 16],
      ["2026-05", 16],
      ["2026-04", 8],
    ]);

    const page1 = await mod.listBragsPage(s.doc);
    expect(page1.brags).toHaveLength(32);
    expect(months(page1)).toEqual(["2026-05", "2026-06"]); // never includes a partial 2026-04
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBe("2026-05");

    const page2 = await mod.listBragsPage(s.doc, {}, page1.nextCursor!);
    expect(page2.brags).toHaveLength(8);
    expect(months(page2)).toEqual(["2026-04"]);
    expect(page2.hasMore).toBe(false);
    expect(page2.nextCursor).toBeNull();

    // The whole point: paging covers every brag once, in the same order as the
    // unwindowed read — no duplicated rows across the boundary, none dropped.
    const { ids, sizes } = await drain(s.doc);
    expect(sizes).toEqual([32, 8]);
    const all = (await mod.listBrags(s.doc)).map((b) => b.id);
    expect(ids).toEqual(all);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never splits a single heavy month across pages", async () => {
    const s = await seed("heavy");
    await insertBrags(s.doc, [
      ["2026-06", 40], // one month already past the target
      ["2026-05", 5],
    ]);

    const page1 = await mod.listBragsPage(s.doc);
    expect(page1.brags).toHaveLength(40); // the whole month, not just 30
    expect(months(page1)).toEqual(["2026-06"]);
    expect(page1.nextCursor).toBe("2026-06");

    const page2 = await mod.listBragsPage(s.doc, {}, page1.nextCursor!);
    expect(page2.brags).toHaveLength(5);
    expect(months(page2)).toEqual(["2026-05"]);
    expect(page2.hasMore).toBe(false);
  });

  it("windows the filtered set, and paging it equals the filtered listBrags", async () => {
    const s = await seed("filter");
    await insertBrags(s.doc, [
      ["2026-06", 16, "shipped-work"],
      ["2026-05", 16, "leadership"],
      ["2026-04", 16, "shipped-work"],
    ]);

    // Filtering drops 2026-05 entirely, so the window is months 06 + 04.
    const filter = { category: "shipped-work" };
    const { ids } = await drain(s.doc, filter);
    const filtered = (await mod.listBrags(s.doc, filter)).map((b) => b.id);
    expect(ids).toEqual(filtered);
    expect(ids).toHaveLength(32);

    // A filter that matches nothing yields an empty terminal page.
    const none = await mod.listBragsPage(s.doc, { category: "recognition" });
    expect(none).toEqual({ brags: [], nextCursor: null, hasMore: false });
  });

  it("the loadMoreTimeline action returns the next page like listBragsPage", async () => {
    const s = await seed("action");
    await insertBrags(s.doc, [
      ["2026-06", 16],
      ["2026-05", 16],
      ["2026-04", 8],
    ]);

    const first = await mod.listBragsPage(s.doc);
    const viaAction = await mod.loadMoreTimeline(s.doc, {}, first.nextCursor!);
    const direct = await mod.listBragsPage(s.doc, {}, first.nextCursor!);

    expect(viaAction.brags.map((b) => b.id)).toEqual(direct.brags.map((b) => b.id));
    expect(viaAction.nextCursor).toBe(direct.nextCursor);
    expect(viaAction.hasMore).toBe(direct.hasMore);
  });
});

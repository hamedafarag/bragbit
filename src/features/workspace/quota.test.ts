// DB-gated test for per-workspace storage quotas (PLAN §10 abuse controls). Seeds a
// workspace with attachments (+ optional per-workspace override) and checks the usage
// sum, the effective quota (override vs instance default), and the exceed predicate.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

async function load() {
  const [dbMod, schema, drizzle, quota] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db/schema"),
    import("drizzle-orm"),
    import("@/features/workspace/quota"),
  ]);
  return { db: dbMod.db, schema, inArray: drizzle.inArray, ...quota };
}

describe.skipIf(!hasDb)("workspace storage quota", () => {
  let mod: Awaited<ReturnType<typeof load>>;
  const orgIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    mod = await load();
  });

  async function seed(quotaMb: number | null, sizes: number[]) {
    const { db, schema } = mod;
    await db.insert(schema.user).values({ id: "q-user", name: "U", email: "q-user@t.local" });
    await db.insert(schema.organization).values({
      id: "q-org",
      name: "Q",
      slug: "q-org",
      type: "organization",
      storageQuotaMb: quotaMb,
    });
    await db
      .insert(schema.document)
      .values({ id: "q-doc", workspaceId: "q-org", userId: "q-user", title: "D" });
    await db.insert(schema.brag).values({ id: "q-brag", documentId: "q-doc", title: "B" });
    if (sizes.length) {
      await db.insert(schema.attachment).values(
        sizes.map((s, i) => ({
          id: `q-att-${i}`,
          bragId: "q-brag",
          storageKey: `q-org/attachments/${i}.png`,
          fileName: `${i}.png`,
          mimeType: "image/png",
          sizeBytes: s,
        })),
      );
    }
    userIds.push("q-user");
    orgIds.push("q-org");
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

  it("sums usage and honours the per-workspace override", async () => {
    await seed(1, [400_000, 300_000]); // 700 KB used, 1 MB quota override
    expect(await mod.workspaceStorageBytes("q-org")).toBe(700_000);
    expect(await mod.workspaceQuotaBytes("q-org")).toBe(1 * 1024 * 1024);
    expect(await mod.exceedsStorageQuota("q-org", 100_000)).toBe(false); // 800 KB < 1 MB
    expect(await mod.exceedsStorageQuota("q-org", 500_000)).toBe(true); // 1.2 MB > 1 MB
  });

  it("falls back to the instance default when there's no override", async () => {
    await seed(null, [1000]);
    expect(await mod.workspaceQuotaBytes("q-org")).toBe(2048 * 1024 * 1024); // WORKSPACE_QUOTA_MB
    expect(await mod.exceedsStorageQuota("q-org", 1000)).toBe(false);
  });
});

// DB-gated test for the shared (Postgres) rate-limit store (ENH-SEC-02). Forces the
// hosted shared-store path via INSTANCE_MODE so the public hitRateLimit takes the
// lazy Postgres branch, then asserts the sliding window + reset + cross-instance
// persistence against real Postgres. Skipped unless DATABASE_URL is set.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);
const prevMode = process.env.INSTANCE_MODE;
process.env.INSTANCE_MODE = "hosted"; // make sharedStoreEnabled() pick the Postgres path

async function load() {
  const [rl, dbMod, schema, drizzle] = await Promise.all([
    import("./rate-limit"),
    import("@/lib/db"),
    import("@/lib/db/schema"),
    import("drizzle-orm"),
  ]);
  return { ...rl, db: dbMod.db, schema, eq: drizzle.eq, like: drizzle.like };
}

describe.skipIf(!hasDb)("shared rate-limit store (Postgres)", () => {
  let mod: Awaited<ReturnType<typeof load>>;

  beforeAll(async () => {
    mod = await load();
  });

  afterEach(async () => {
    const { db, schema, like } = mod;
    await db.delete(schema.rateLimitHit).where(like(schema.rateLimitHit.key, "pgtest:%"));
  });

  afterAll(async () => {
    if (prevMode === undefined) delete process.env.INSTANCE_MODE;
    else process.env.INSTANCE_MODE = prevMode;
    await (
      globalThis as { __bragbitClient?: { end?: (o?: unknown) => Promise<void> } }
    ).__bragbitClient
      ?.end?.({ timeout: 5 })
      .catch(() => {});
  });

  it("allows up to the limit, then blocks within the window", async () => {
    const key = "pgtest:block";
    for (let i = 0; i < 3; i++) {
      expect((await mod.hitRateLimit(key, 3, 1000, 1000 + i)).ok).toBe(true);
    }
    const blocked = await mod.hitRateLimit(key, 3, 1000, 1003);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("slides the window past old attempts, and reset clears the key", async () => {
    const key = "pgtest:slide";
    expect((await mod.hitRateLimit(key, 2, 1000, 0)).ok).toBe(true);
    expect((await mod.hitRateLimit(key, 2, 1000, 500)).ok).toBe(true);
    expect((await mod.hitRateLimit(key, 2, 1000, 600)).ok).toBe(false); // both in window
    expect((await mod.hitRateLimit(key, 2, 1000, 1600)).ok).toBe(true); // t=0 + t=500 expired
    await mod.resetRateLimit(key);
    expect((await mod.hitRateLimit(key, 2, 1000, 1700)).ok).toBe(true);
  });

  it("persists attempts in the shared table (visible to any instance)", async () => {
    const { db, schema, eq } = mod;
    await mod.hitRateLimit("pgtest:persist", 5, 60_000, 5000);
    const rows = await db
      .select()
      .from(schema.rateLimitHit)
      .where(eq(schema.rateLimitHit.key, "pgtest:persist"));
    expect(rows).toHaveLength(1);
  });
});

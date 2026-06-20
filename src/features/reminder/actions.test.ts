// DB-gated integration tests for the reminder actions (ENH-TEST L2-7).
// updateReminderSettings upserts the prefs; unsubscribeReminders verifies the
// stateless HMAC token (real, keyed by BETTER_AUTH_SECRET) and flips the flag.
// Both run against real Postgres behind a mocked requireSession. Skipped unless
// DATABASE_URL is set.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

const authCtx = vi.hoisted(() => ({ user: { id: "" } }));
vi.mock("@/lib/auth/guards", () => ({ requireSession: async () => authCtx }));

async function load() {
  const [dbMod, schema, drizzle, actions, unsub] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db/schema"),
    import("drizzle-orm"),
    import("@/features/reminder/actions"),
    import("@/features/reminder/unsubscribe"),
  ]);
  return {
    db: dbMod.db,
    schema,
    eq: drizzle.eq,
    inArray: drizzle.inArray,
    unsubscribeToken: unsub.unsubscribeToken,
    ...actions,
  };
}

describe.skipIf(!hasDb)("reminder actions", () => {
  let mod: Awaited<ReturnType<typeof load>>;
  const userIds: string[] = [];

  beforeAll(async () => {
    mod = await load();
  });

  async function seedUser(sfx: string, withProfile = false) {
    const { db, schema } = mod;
    const id = `remact-user-${sfx}`;
    await db.insert(schema.user).values({ id, name: "U", email: `${id}@t.local` });
    if (withProfile)
      await db
        .insert(schema.profile)
        .values({ userId: id, displayName: "U", reminderEnabled: true });
    userIds.push(id);
    authCtx.user.id = id;
    return id;
  }

  afterEach(async () => {
    const { db, schema, inArray } = mod;
    if (userIds.length) await db.delete(schema.user).where(inArray(schema.user.id, userIds));
    userIds.length = 0;
  });

  afterAll(async () => {
    await (
      globalThis as { __bragbitClient?: { end?: (o?: unknown) => Promise<void> } }
    ).__bragbitClient
      ?.end?.({ timeout: 5 })
      .catch(() => {});
  });

  it("updateReminderSettings upserts the prefs; rejects an unknown time zone", async () => {
    const { db, schema, eq } = mod;
    const id = await seedUser("save");

    expect(
      await mod.updateReminderSettings({ enabled: true, day: 3, timezone: "Europe/Berlin" }),
    ).toEqual({ ok: true });
    const [p] = await db.select().from(schema.profile).where(eq(schema.profile.userId, id));
    expect(p).toMatchObject({ reminderEnabled: true, reminderDay: 3, timezone: "Europe/Berlin" });

    expect(
      (await mod.updateReminderSettings({ enabled: true, day: 1, timezone: "Mars/Phobos" })).ok,
    ).toBe(false);
  });

  it("unsubscribeReminders disables on a valid token and rejects a forged one", async () => {
    const { db, schema, eq, unsubscribeToken } = mod;
    const id = await seedUser("unsub", true);

    // forged token → rejected, flag unchanged
    expect(await mod.unsubscribeReminders(id, "forged")).toEqual({
      ok: false,
      error: "This unsubscribe link is invalid.",
    });
    let [p] = await db
      .select({ on: schema.profile.reminderEnabled })
      .from(schema.profile)
      .where(eq(schema.profile.userId, id));
    expect(p.on).toBe(true);

    // valid token → disabled
    expect(await mod.unsubscribeReminders(id, unsubscribeToken(id))).toEqual({ ok: true });
    [p] = await db
      .select({ on: schema.profile.reminderEnabled })
      .from(schema.profile)
      .where(eq(schema.profile.userId, id));
    expect(p.on).toBe(false);
  });
});

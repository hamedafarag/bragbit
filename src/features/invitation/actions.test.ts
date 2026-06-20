// DB-gated integration tests for the invitation accept actions (ENH-TEST L2-2).
// Real Postgres + the in-house rate limiter for the validation / rate-limit /
// invalid-invite paths and the emailVerified flip; Better Auth's sign-up/sign-in/
// accept endpoints are stubbed (they need a real request session). Skipped unless
// DATABASE_URL is set; mirrors object-cleanup.test.ts.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

const api = vi.hoisted(() => ({
  signUpEmail: vi.fn(),
  signInEmail: vi.fn(),
  acceptInvitation: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

async function load() {
  const [dbMod, schema, drizzle, actions] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db/schema"),
    import("drizzle-orm"),
    import("@/features/invitation/actions"),
  ]);
  return { db: dbMod.db, schema, eq: drizzle.eq, inArray: drizzle.inArray, ...actions };
}

describe.skipIf(!hasDb)("invitation accept actions", () => {
  let mod: Awaited<ReturnType<typeof load>>;
  const orgIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    mod = await load();
  });

  /** Seed an org, an inviter, a pending invitation, and the (unverified) invitee
   *  user that Better Auth's sign-up would have created. */
  async function seed(sfx: string, expiresAt = new Date(Date.now() + 86_400_000)) {
    const { db, schema } = mod;
    const ids = {
      org: `invact-org-${sfx}`,
      inviter: `invact-inviter-${sfx}`,
      invitee: `invact-invitee-${sfx}`,
      inv: `invact-inv-${sfx}`,
      email: `invitee-${sfx}@t.local`,
    };
    await db.insert(schema.organization).values({ id: ids.org, name: `Inv ${sfx}`, slug: ids.org });
    await db.insert(schema.user).values([
      { id: ids.inviter, name: "Inviter", email: `${ids.inviter}@t.local` },
      { id: ids.invitee, name: "Invitee", email: ids.email, emailVerified: false },
    ]);
    await db.insert(schema.invitation).values({
      id: ids.inv,
      organizationId: ids.org,
      email: ids.email,
      role: "member",
      status: "pending",
      expiresAt,
      inviterId: ids.inviter,
    });
    orgIds.push(ids.org);
    userIds.push(ids.inviter, ids.invitee);
    return ids;
  }

  afterEach(async () => {
    const { db, schema, inArray } = mod;
    if (userIds.length) await db.delete(schema.user).where(inArray(schema.user.id, userIds));
    if (orgIds.length)
      await db.delete(schema.organization).where(inArray(schema.organization.id, orgIds));
    userIds.length = 0;
    orgIds.length = 0;
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await (
      globalThis as { __bragbitClient?: { end?: (o?: unknown) => Promise<void> } }
    ).__bragbitClient
      ?.end?.({ timeout: 5 })
      .catch(() => {});
  });

  it("registerInvitee rejects invalid input", async () => {
    const res = await mod.registerInvitee("any", { name: "", password: "short" });
    expect(res.ok).toBe(false);
  });

  it("registerInvitee rejects an unknown/expired invitation", async () => {
    // no seed → getPendingInvitation returns null
    expect(
      await mod.registerInvitee(`missing-${Date.now()}`, { name: "A", password: "password1" }),
    ).toEqual({
      ok: false,
      error: "This invitation is invalid or has expired.",
    });
    // an expired one is also rejected
    const s = await seed("expired", new Date(Date.now() - 1000));
    expect((await mod.registerInvitee(s.inv, { name: "A", password: "password1" })).ok).toBe(false);
  });

  it("registerInvitee signs up the invitee and marks them verified", async () => {
    const { db, schema, eq } = mod;
    const s = await seed("ok");
    api.signUpEmail.mockResolvedValueOnce({ user: { id: s.invitee } });
    api.signInEmail.mockResolvedValueOnce({ token: "t" });

    expect(await mod.registerInvitee(s.inv, { name: "Invitee", password: "password1" })).toEqual({
      ok: true,
    });
    // bound to the INVITED email, never a client-supplied one
    expect(api.signUpEmail).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ email: s.email }) }),
    );
    const [u] = await db
      .select({ verified: schema.user.emailVerified })
      .from(schema.user)
      .where(eq(schema.user.email, s.email));
    expect(u.verified).toBe(true);
  });

  it("registerInvitee rate-limits repeated attempts on one invitation link", async () => {
    const id = `rl-${Date.now()}`;
    const input = { name: "A", password: "password1" };
    // 8 attempts are allowed (invite is invalid, but the limiter still counts);
    // the 9th is blocked.
    let lastInvalid;
    for (let i = 0; i < 8; i++) lastInvalid = await mod.registerInvitee(id, input);
    expect(lastInvalid).toEqual({ ok: false, error: "This invitation is invalid or has expired." });
    expect(await mod.registerInvitee(id, input)).toEqual({
      ok: false,
      error: "Too many attempts. Please wait a few minutes and try again.",
    });
  });

  it("acceptInvitation delegates and surfaces failures", async () => {
    api.acceptInvitation.mockResolvedValueOnce({});
    expect(await mod.acceptInvitation("inv-1")).toEqual({ ok: true });

    api.acceptInvitation.mockRejectedValueOnce(new Error("email mismatch"));
    expect(await mod.acceptInvitation("inv-1")).toEqual({ ok: false, error: "email mismatch" });
  });
});

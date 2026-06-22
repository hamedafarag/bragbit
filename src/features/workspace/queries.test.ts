// DB-gated test for listUserWorkspaces (the data behind the header switcher). Mocks
// the DAL guard; seeds a user with a personal + an org membership (plus another
// user's org) and asserts the list, ordering, role, the active flag, and isolation.
// Skipped unless DATABASE_URL is set.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

const authCtx = vi.hoisted(() => ({
  workspaceId: "",
  user: { id: "" },
  member: { role: "owner" },
}));
vi.mock("@/lib/auth/guards", () => ({
  requireWorkspace: async () => authCtx,
  requireRole: async () => authCtx,
}));
// redirect throws a recognizable error so the suspension-bounce branch is testable.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
const hostedFlag = vi.hoisted(() => ({ value: false }));
vi.mock("@/lib/instance", () => ({ isHosted: () => hostedFlag.value }));
vi.mock("next/server", () => ({ connection: async () => {} }));

async function load() {
  const [dbMod, schema, drizzle, queries] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db/schema"),
    import("drizzle-orm"),
    import("@/features/workspace/queries"),
  ]);
  return { db: dbMod.db, schema, inArray: drizzle.inArray, ...queries };
}

describe.skipIf(!hasDb)("listUserWorkspaces", () => {
  let mod: Awaited<ReturnType<typeof load>>;
  const orgIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    mod = await load();
  });

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

  it("lists the caller's workspaces (personal first) with role + active flag; excludes others'", async () => {
    const { db, schema } = mod;
    await db.insert(schema.user).values([
      { id: "lw-user", name: "U", email: "lw-user@t.local" },
      { id: "lw-other", name: "O", email: "lw-other@t.local" },
    ]);
    userIds.push("lw-user", "lw-other");
    await db.insert(schema.organization).values([
      { id: "lw-personal", name: "My Logbook", slug: "lw-personal", type: "personal" },
      { id: "lw-acme", name: "Acme", slug: "lw-acme", type: "organization" },
      { id: "lw-other-org", name: "Other Co", slug: "lw-other-org", type: "organization" },
    ]);
    orgIds.push("lw-personal", "lw-acme", "lw-other-org");
    await db.insert(schema.member).values([
      { id: "lw-m1", organizationId: "lw-personal", userId: "lw-user", role: "owner" },
      { id: "lw-m2", organizationId: "lw-acme", userId: "lw-user", role: "admin" },
      { id: "lw-m3", organizationId: "lw-other-org", userId: "lw-other", role: "owner" },
    ]);

    authCtx.user.id = "lw-user";
    authCtx.workspaceId = "lw-acme"; // the active one

    const list = await mod.listUserWorkspaces();
    expect(list.map((w) => w.id)).toEqual(["lw-personal", "lw-acme"]); // personal first; other user's absent
    expect(list.find((w) => w.id === "lw-personal")).toMatchObject({
      type: "personal",
      role: "owner",
      isActive: false,
    });
    expect(list.find((w) => w.id === "lw-acme")).toMatchObject({
      type: "organization",
      role: "admin",
      isActive: true,
    });
  });

  it("getActiveWorkspace returns the workspace + role when nothing is suspended", async () => {
    const { db, schema } = mod;
    await db.insert(schema.user).values({ id: "gaw-u", name: "U", email: "gaw-u@t.local" });
    userIds.push("gaw-u");
    await db
      .insert(schema.organization)
      .values({ id: "gaw-o", name: "Acme", slug: "gaw-o", type: "organization" });
    orgIds.push("gaw-o");
    authCtx.user.id = "gaw-u";
    authCtx.workspaceId = "gaw-o";
    authCtx.member.role = "owner";

    const res = await mod.getActiveWorkspace();
    expect(res.workspace.id).toBe("gaw-o");
    expect(res.role).toBe("owner");
  });

  it("getActiveWorkspace bounces a suspended workspace to /suspended", async () => {
    const { db, schema } = mod;
    await db.insert(schema.user).values({ id: "gaw-u2", name: "U", email: "gaw-u2@t.local" });
    userIds.push("gaw-u2");
    await db.insert(schema.organization).values({
      id: "gaw-o2",
      name: "Acme",
      slug: "gaw-o2",
      type: "organization",
      suspendedAt: new Date(),
    });
    orgIds.push("gaw-o2");
    authCtx.user.id = "gaw-u2";
    authCtx.workspaceId = "gaw-o2";

    await expect(mod.getActiveWorkspace()).rejects.toThrow("REDIRECT:/suspended");
  });

  it("getActiveWorkspace bounces a suspended account to /suspended", async () => {
    const { db, schema } = mod;
    await db
      .insert(schema.user)
      .values({ id: "gaw-u3", name: "U", email: "gaw-u3@t.local", suspendedAt: new Date() });
    userIds.push("gaw-u3");
    await db
      .insert(schema.organization)
      .values({ id: "gaw-o3", name: "Acme", slug: "gaw-o3", type: "organization" });
    orgIds.push("gaw-o3");
    authCtx.user.id = "gaw-u3";
    authCtx.workspaceId = "gaw-o3";

    await expect(mod.getActiveWorkspace()).rejects.toThrow("REDIRECT:/suspended");
  });

  it("listMembers returns members with role, join date, and last activity", async () => {
    const { db, schema } = mod;
    await db.insert(schema.user).values([
      { id: "lm-owner", name: "Owner", email: "lm-owner@t.local" },
      { id: "lm-member", name: "Member", email: "lm-member@t.local" },
    ]);
    userIds.push("lm-owner", "lm-member");
    await db
      .insert(schema.organization)
      .values({ id: "lm-org", name: "Acme", slug: "lm-org", type: "organization" });
    orgIds.push("lm-org");
    await db.insert(schema.member).values([
      { id: "lm-m1", organizationId: "lm-org", userId: "lm-owner", role: "owner" },
      { id: "lm-m2", organizationId: "lm-org", userId: "lm-member", role: "member" },
    ]);
    // A session for the owner → a lastActiveAt; the member has none.
    await db.insert(schema.session).values({
      id: "lm-sess",
      userId: "lm-owner",
      token: "lm-tok",
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    authCtx.workspaceId = "lm-org";

    const members = await mod.listMembers();
    expect(members.map((m) => m.userId).sort()).toEqual(["lm-member", "lm-owner"]);
    const owner = members.find((m) => m.userId === "lm-owner")!;
    expect(owner.role).toBe("owner");
    expect(owner.lastActiveAt).not.toBeNull(); // has a session → an activity timestamp
    expect(members.find((m) => m.userId === "lm-member")!.lastActiveAt).toBeNull();
  });

  it("listPendingInvitations returns only valid (pending, unexpired) invites", async () => {
    const { db, schema } = mod;
    await db
      .insert(schema.user)
      .values({ id: "lpi-inviter", name: "I", email: "lpi-inviter@t.local" });
    userIds.push("lpi-inviter");
    await db
      .insert(schema.organization)
      .values({ id: "lpi-org", name: "Acme", slug: "lpi-org", type: "organization" });
    orgIds.push("lpi-org");
    const future = new Date(Date.now() + 7 * 86_400_000);
    const past = new Date(Date.now() - 86_400_000);
    await db.insert(schema.invitation).values([
      // pending + unexpired → returned
      { id: "lpi-valid", organizationId: "lpi-org", email: "valid@t.local", role: "member", status: "pending", expiresAt: future, inviterId: "lpi-inviter" }, // prettier-ignore
      // pending but expired → filtered out by isAcceptableInvitation
      { id: "lpi-expired", organizationId: "lpi-org", email: "expired@t.local", role: "member", status: "pending", expiresAt: past, inviterId: "lpi-inviter" }, // prettier-ignore
      // already accepted → not even fetched (status != pending)
      { id: "lpi-accepted", organizationId: "lpi-org", email: "accepted@t.local", role: "member", status: "accepted", expiresAt: future, inviterId: "lpi-inviter" }, // prettier-ignore
    ]);
    authCtx.workspaceId = "lpi-org";

    const invites = await mod.listPendingInvitations();
    expect(invites.map((i) => i.id)).toEqual(["lpi-valid"]);
    expect(invites[0]).toMatchObject({ email: "valid@t.local", role: "member" });
  });

  it("getInstanceBranding is null on a hosted instance, a brand on a private one", async () => {
    hostedFlag.value = true;
    await expect(mod.getInstanceBranding()).resolves.toBeNull();

    hostedFlag.value = false;
    const { db, schema } = mod;
    await db.insert(schema.organization).values({
      id: "gib-org",
      name: "Solo",
      slug: "gib-org",
      type: "personal",
      accentColor: "#123456",
    });
    orgIds.push("gib-org");
    const brand = await mod.getInstanceBranding();
    expect(brand).not.toBeNull();
    expect(typeof brand!.name).toBe("string");
  });
});

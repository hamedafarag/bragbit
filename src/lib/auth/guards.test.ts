// DB-gated tests for the DAL guards (PLAN §6) — the session + membership gate that
// every workspace-scoped read/write passes through. The session source (auth.api),
// request headers, navigation (redirect/notFound throw a recognizable error), and the
// superadmin allowlist are mocked; the membership lookup runs against real Postgres.
// Skipped unless DATABASE_URL is set.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

type SessionData = {
  user: { id: string; email: string };
  session: { activeOrganizationId: string | null };
};
const sess = vi.hoisted(() => ({ value: null as SessionData | null }));
const superFlag = vi.hoisted(() => ({ value: false }));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: async () => sess.value } } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/super", () => ({ isSuperadmin: () => superFlag.value }));

async function load() {
  const [dbMod, schema, drizzle, guards] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db/schema"),
    import("drizzle-orm"),
    import("@/lib/auth/guards"),
  ]);
  return { db: dbMod.db, schema, inArray: drizzle.inArray, ...guards };
}

describe.skipIf(!hasDb)("DAL guards", () => {
  let mod: Awaited<ReturnType<typeof load>>;

  beforeAll(async () => {
    mod = await load();
    const { db, schema } = mod;
    await db.insert(schema.user).values([
      { id: "g-user", name: "U", email: "g-user@t.local" },
      { id: "g-stranger", name: "S", email: "g-stranger@t.local" },
    ]);
    await db
      .insert(schema.organization)
      .values({ id: "g-org", name: "Acme", slug: "g-org", type: "organization" });
    await db
      .insert(schema.member)
      .values({ id: "g-mem", organizationId: "g-org", userId: "g-user", role: "member" });
  });

  afterAll(async () => {
    const { db, schema, inArray } = mod;
    await db.delete(schema.user).where(inArray(schema.user.id, ["g-user", "g-stranger"]));
    await db.delete(schema.organization).where(inArray(schema.organization.id, ["g-org"]));
    await (
      globalThis as { __bragbitClient?: { end?: (o?: unknown) => Promise<void> } }
    ).__bragbitClient
      ?.end?.({ timeout: 5 })
      .catch(() => {});
  });

  beforeEach(() => {
    sess.value = null;
    superFlag.value = false;
  });

  const asUser = (activeOrganizationId: string | null, id = "g-user") => {
    sess.value = { user: { id, email: `${id}@t.local` }, session: { activeOrganizationId } };
  };

  it("requireSession redirects to sign-in without a session, returns data with one", async () => {
    await expect(mod.requireSession()).rejects.toThrow("REDIRECT:/sign-in");
    asUser("g-org");
    await expect(mod.requireSession()).resolves.toMatchObject({ user: { id: "g-user" } });
  });

  it("requireWorkspace bounces to /no-workspace with no active org", async () => {
    asUser(null);
    await expect(mod.requireWorkspace()).rejects.toThrow("REDIRECT:/no-workspace");
  });

  it("requireWorkspace bounces a non-member to /no-workspace", async () => {
    asUser("g-org", "g-stranger");
    await expect(mod.requireWorkspace()).rejects.toThrow("REDIRECT:/no-workspace");
  });

  it("requireWorkspace returns the membership for a real member", async () => {
    asUser("g-org");
    await expect(mod.requireWorkspace()).resolves.toMatchObject({
      workspaceId: "g-org",
      member: { role: "member" },
    });
  });

  it("requireRole redirects to /dashboard when the role is insufficient", async () => {
    asUser("g-org");
    await expect(mod.requireRole("owner", "admin")).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("requireRole returns the context when the role matches", async () => {
    asUser("g-org");
    await expect(mod.requireRole("member")).resolves.toMatchObject({ workspaceId: "g-org" });
  });

  it("requireSuperadmin 404s a non-superadmin, returns the session for an allowlisted email", async () => {
    asUser("g-org");
    await expect(mod.requireSuperadmin()).rejects.toThrow("NOT_FOUND");
    superFlag.value = true;
    await expect(mod.requireSuperadmin()).resolves.toMatchObject({ user: { id: "g-user" } });
  });

  it("getSessionOrNull returns null without a session and the data with one", async () => {
    await expect(mod.getSessionOrNull()).resolves.toBeNull();
    asUser("g-org");
    await expect(mod.getSessionOrNull()).resolves.toMatchObject({ user: { id: "g-user" } });
  });

  it("getWorkspaceOrNull returns null for no session / no org / non-member, ctx for a member", async () => {
    await expect(mod.getWorkspaceOrNull()).resolves.toBeNull(); // no session
    asUser(null);
    await expect(mod.getWorkspaceOrNull()).resolves.toBeNull(); // no active org
    asUser("g-org", "g-stranger");
    await expect(mod.getWorkspaceOrNull()).resolves.toBeNull(); // not a member
    asUser("g-org");
    await expect(mod.getWorkspaceOrNull()).resolves.toMatchObject({ workspaceId: "g-org" });
  });

  it("isWorkspaceMember reflects membership", async () => {
    await expect(mod.isWorkspaceMember("g-user", "g-org")).resolves.toBe(true);
    await expect(mod.isWorkspaceMember("g-stranger", "g-org")).resolves.toBe(false);
  });
});

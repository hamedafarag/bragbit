// DB-gated integration tests for the workspace server actions (ENH-TEST L2-1).
// Real Postgres for the Drizzle/validation/scoping logic (branding update, the
// atomic transferOwnership transaction, removeMember's self/owner/not-found
// guards, cross-workspace invitation scoping); Better Auth's org endpoints
// (`auth.api.*`) are stubbed so the delegation + error handling is covered
// without a real session — the org-permission behavior itself is Better Auth's.
//
// Skipped unless DATABASE_URL is set (the CI `database` job sets it); mirrors the
// pattern in src/features/attachment/object-cleanup.test.ts.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

// The caller the mocked DAL guard reports (an owner/admin who passed the gate).
const authCtx = vi.hoisted(() => ({
  workspaceId: "",
  user: { id: "" },
  session: {},
  member: { role: "owner" },
}));
// Stubbed Better Auth org endpoints — each test sets resolve/reject as needed.
const api = vi.hoisted(() => ({
  createInvitation: vi.fn(),
  cancelInvitation: vi.fn(),
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
  createOrganization: vi.fn(),
  setActiveOrganization: vi.fn(),
}));
const offboard = vi.hoisted(() => ({ emailRemovedMemberBundle: vi.fn() }));
// Toggles the hosted org-creation capability for the createOrganizationWorkspace tests.
const inst = vi.hoisted(() => ({ allows: true }));

vi.mock("@/lib/auth/guards", () => ({
  requireRole: async () => authCtx,
  requireWorkspace: async () => authCtx,
  requireSession: async () => authCtx,
}));
vi.mock("@/lib/auth", () => ({ auth: { api } }));
vi.mock("@/lib/instance", () => ({ allowsOrgCreation: () => inst.allows }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/features/workspace/offboard", () => offboard);

async function load() {
  const [dbMod, schema, drizzle, actions] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db/schema"),
    import("drizzle-orm"),
    import("@/features/workspace/actions"),
  ]);
  return { db: dbMod.db, schema, eq: drizzle.eq, inArray: drizzle.inArray, ...actions };
}

describe.skipIf(!hasDb)("workspace server actions", () => {
  let mod: Awaited<ReturnType<typeof load>>;
  const orgIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    mod = await load();
  });

  /** Seed an org with an owner (the caller), an admin, and a removable member. */
  async function seed(sfx: string) {
    const { db, schema } = mod;
    const ids = {
      org: `wsact-org-${sfx}`,
      owner: `wsact-owner-${sfx}`,
      admin: `wsact-admin-${sfx}`,
      member: `wsact-member-${sfx}`,
      memOwner: `wsact-m-owner-${sfx}`,
      memAdmin: `wsact-m-admin-${sfx}`,
      memMember: `wsact-m-member-${sfx}`,
    };
    await db.insert(schema.organization).values({ id: ids.org, name: `WS ${sfx}`, slug: ids.org });
    await db.insert(schema.user).values([
      { id: ids.owner, name: "Owner", email: `${ids.owner}@t.local` },
      { id: ids.admin, name: "Admin", email: `${ids.admin}@t.local` },
      { id: ids.member, name: "Member", email: `${ids.member}@t.local` },
    ]);
    await db.insert(schema.member).values([
      { id: ids.memOwner, organizationId: ids.org, userId: ids.owner, role: "owner" },
      { id: ids.memAdmin, organizationId: ids.org, userId: ids.admin, role: "admin" },
      { id: ids.memMember, organizationId: ids.org, userId: ids.member, role: "member" },
    ]);
    orgIds.push(ids.org);
    userIds.push(ids.owner, ids.admin, ids.member);
    authCtx.workspaceId = ids.org;
    authCtx.user.id = ids.owner;
    authCtx.member.role = "owner";
    return ids;
  }

  afterEach(async () => {
    const { db, schema, inArray } = mod;
    if (userIds.length) await db.delete(schema.user).where(inArray(schema.user.id, userIds));
    if (orgIds.length)
      await db.delete(schema.organization).where(inArray(schema.organization.id, orgIds));
    userIds.length = 0;
    orgIds.length = 0;
    inst.allows = true;
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await (
      globalThis as { __bragbitClient?: { end?: (o?: unknown) => Promise<void> } }
    ).__bragbitClient
      ?.end?.({ timeout: 5 })
      .catch(() => {});
  });

  it("updateWorkspaceBranding writes name + accent, and rejects a bad hex", async () => {
    const { db, schema, eq } = mod;
    const s = await seed("brand");

    expect(await mod.updateWorkspaceBranding({ name: "Renamed", accentColor: "#123abc" })).toEqual({
      ok: true,
    });
    const [org] = await db
      .select({ name: schema.organization.name, accent: schema.organization.accentColor })
      .from(schema.organization)
      .where(eq(schema.organization.id, s.org));
    expect(org).toEqual({ name: "Renamed", accent: "#123abc" });

    const bad = await mod.updateWorkspaceBranding({ name: "X", accentColor: "not-a-hex" });
    expect(bad.ok).toBe(false);
  });

  it("transferOwnership atomically swaps owner↔admin; rejects self + unknown member", async () => {
    const { db, schema, eq } = mod;
    const s = await seed("xfer");

    expect(await mod.transferOwnership(s.memAdmin)).toEqual({ ok: true });
    const roles = Object.fromEntries(
      (
        await db
          .select({ id: schema.member.id, role: schema.member.role })
          .from(schema.member)
          .where(eq(schema.member.organizationId, s.org))
      ).map((m) => [m.id, m.role]),
    );
    expect(roles[s.memAdmin]).toBe("owner"); // target promoted
    expect(roles[s.memOwner]).toBe("admin"); // caller stepped down
    // exactly one owner remains
    expect(Object.values(roles).filter((r) => r === "owner")).toHaveLength(1);

    expect((await mod.transferOwnership(s.memOwner)).ok).toBe(false); // self (still the caller's row)
    expect(await mod.transferOwnership("does-not-exist")).toEqual({
      ok: false,
      error: "Member not found.",
    });
  });

  it("removeMember enforces self / owner / not-found, else delegates + emails the bundle", async () => {
    const s = await seed("rm");

    // self-removal blocked (caller is the owner row's user)
    expect(await mod.removeMember(s.memOwner)).toEqual({
      ok: false,
      error: "You can't remove yourself.",
    });
    // owner can't be removed — make the caller an admin removing the owner
    authCtx.user.id = s.admin;
    expect(await mod.removeMember(s.memOwner)).toEqual({
      ok: false,
      error: "The owner can't be removed.",
    });
    // unknown member
    expect(await mod.removeMember("nope")).toEqual({ ok: false, error: "Member not found." });

    // happy path: Better Auth removal stubbed → success, and the offboard bundle is sent
    api.removeMember.mockResolvedValueOnce({});
    expect(await mod.removeMember(s.memMember)).toEqual({ ok: true });
    expect(api.removeMember).toHaveBeenCalledWith(
      expect.objectContaining({ body: { memberIdOrEmail: s.memMember } }),
    );
    expect(offboard.emailRemovedMemberBundle).toHaveBeenCalledTimes(1);
  });

  it("removeMember stays ok even when the offboard email throws (best-effort)", async () => {
    const s = await seed("rm-mailfail");
    api.removeMember.mockResolvedValueOnce({});
    offboard.emailRemovedMemberBundle.mockRejectedValueOnce(new Error("smtp down"));
    expect(await mod.removeMember(s.memMember)).toEqual({ ok: true });
  });

  it("changeMemberRole validates the role then delegates", async () => {
    const s = await seed("role");
    expect(await mod.changeMemberRole(s.memMember, "supervisor")).toEqual({
      ok: false,
      error: "Invalid role.",
    });
    api.updateMemberRole.mockResolvedValueOnce({});
    expect(await mod.changeMemberRole(s.memMember, "admin")).toEqual({ ok: true });
    expect(api.updateMemberRole).toHaveBeenCalledWith(
      expect.objectContaining({ body: { memberId: s.memMember, role: "admin" } }),
    );
  });

  it("inviteMembers validates, and reports per-email failures without failing the batch", async () => {
    await seed("invite");
    expect((await mod.inviteMembers({ emails: ["nope"], role: "member" })).ok).toBe(false); // bad email

    api.createInvitation
      .mockResolvedValueOnce({}) // a@ ok
      .mockRejectedValueOnce(new Error("already a member")); // b@ fails
    const res = await mod.inviteMembers({ emails: ["a@t.local", "b@t.local"], role: "member" });
    expect(res).toMatchObject({ ok: true, invited: 1 });
    expect(res.ok && res.failures).toHaveLength(1);
  });

  it("revokeInvitation reports success and surfaces failures", async () => {
    await seed("revoke");
    api.cancelInvitation.mockResolvedValueOnce({});
    expect(await mod.revokeInvitation("inv-1")).toEqual({ ok: true });

    api.cancelInvitation.mockRejectedValueOnce(new Error("gone"));
    expect(await mod.revokeInvitation("inv-1")).toEqual({ ok: false, error: "gone" });
  });

  it("resendInvitation 404s a cross-workspace invite, else re-issues by stored email", async () => {
    const { db, schema } = mod;
    const s = await seed("resend");
    // an invitation in a DIFFERENT workspace must not be resendable from this one
    await db
      .insert(schema.organization)
      .values({ id: `${s.org}-other`, name: "Other", slug: `${s.org}-other` });
    orgIds.push(`${s.org}-other`);
    await db.insert(schema.invitation).values({
      id: `inv-cross-${s.org}`,
      organizationId: `${s.org}-other`,
      email: "x@t.local",
      role: "member",
      status: "pending",
      expiresAt: new Date(Date.now() + 86_400_000),
      inviterId: s.owner,
    });
    expect(await mod.resendInvitation(`inv-cross-${s.org}`)).toEqual({
      ok: false,
      error: "Invitation not found.",
    });

    // an invitation in THIS workspace re-issues via Better Auth with its stored email
    await db.insert(schema.invitation).values({
      id: `inv-own-${s.org}`,
      organizationId: s.org,
      email: "y@t.local",
      role: "admin",
      status: "pending",
      expiresAt: new Date(Date.now() + 86_400_000),
      inviterId: s.owner,
    });
    api.createInvitation.mockResolvedValueOnce({});
    expect(await mod.resendInvitation(`inv-own-${s.org}`)).toEqual({ ok: true });
    expect(api.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ body: { email: "y@t.local", role: "admin", resend: true } }),
    );
  });

  it("createOrganizationWorkspace creates an org owned by the caller and switches into it", async () => {
    api.createOrganization.mockResolvedValueOnce({ id: "new-org-id" });
    api.setActiveOrganization.mockResolvedValueOnce({});

    const res = await mod.createOrganizationWorkspace({ name: "Acme Corp" });
    expect(res).toEqual({ ok: true, id: "new-org-id" });
    expect(api.createOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          name: "Acme Corp",
          slug: "acme-corp",
          type: "organization",
        }),
      }),
    );
    expect(api.setActiveOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ body: { organizationId: "new-org-id" } }),
    );
  });

  it("createOrganizationWorkspace suffixes the slug when the base is taken", async () => {
    const { db, schema } = mod;
    await db
      .insert(schema.organization)
      .values({ id: "dupe-org", name: "Taken", slug: "taken-name" });
    orgIds.push("dupe-org");
    api.createOrganization.mockResolvedValueOnce({ id: "new-org-2" });
    api.setActiveOrganization.mockResolvedValueOnce({});

    await mod.createOrganizationWorkspace({ name: "Taken Name" });
    expect(api.createOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ slug: expect.stringMatching(/^taken-name-[0-9a-f]{6}$/) }),
      }),
    );
  });

  it("createOrganizationWorkspace validates input and respects the hosted gate", async () => {
    // empty name → validation error, no API call
    expect((await mod.createOrganizationWorkspace({ name: "  " })).ok).toBe(false);
    expect(api.createOrganization).not.toHaveBeenCalled();

    // gate off → not available, no API call
    inst.allows = false;
    expect(await mod.createOrganizationWorkspace({ name: "Acme" })).toEqual({
      ok: false,
      error: "Creating organizations isn't available on this instance.",
    });
    expect(api.createOrganization).not.toHaveBeenCalled();
  });
});

// DB-gated tests for the first-run setup action (ENH-TEST L2-3). completeSetup's
// guard ladder (hosted / validation / setup-token / already-setup) is covered
// directly; the create-owner-and-workspace path delegates to Better Auth's
// `auth.api.*` (stubbed). `isInstanceSetup` is a GLOBAL check (any org in the DB),
// which is non-deterministic under the parallel DB-gated suites, so it's mocked
// per-test. Skipped unless DATABASE_URL is set.
//
// SETUP_TOKEN must be set before @/lib/env is parsed (first touched in load()).
process.env.SETUP_TOKEN = "test-setup-token";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

const api = vi.hoisted(() => ({
  signUpEmail: vi.fn(),
  signInEmail: vi.fn(),
  createOrganization: vi.fn(),
}));
const instance = vi.hoisted(() => ({
  isHosted: vi.fn(() => false),
  isPrivateSolo: vi.fn(() => true),
}));
const setupQueries = vi.hoisted(() => ({ isInstanceSetup: vi.fn(async () => false) }));

vi.mock("@/lib/auth", () => ({ auth: { api } }));
vi.mock("@/lib/instance", () => instance);
vi.mock("@/features/setup/queries", () => setupQueries);
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

async function load() {
  const actions = await import("@/features/setup/actions");
  return actions;
}

const VALID = {
  name: "Ada",
  email: "ada@t.local",
  password: "password1",
  workspaceName: "Ada's Logbook",
  setupToken: "test-setup-token",
};

describe.skipIf(!hasDb)("completeSetup", () => {
  let mod: Awaited<ReturnType<typeof load>>;

  beforeAll(async () => {
    mod = await load();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    instance.isHosted.mockReturnValue(false);
    instance.isPrivateSolo.mockReturnValue(true);
    setupQueries.isInstanceSetup.mockResolvedValue(false);
  });

  afterAll(async () => {
    await (
      globalThis as { __bragbitClient?: { end?: (o?: unknown) => Promise<void> } }
    ).__bragbitClient
      ?.end?.({ timeout: 5 })
      .catch(() => {});
  });

  it("refuses to run on a hosted instance", async () => {
    instance.isHosted.mockReturnValue(true);
    expect(await mod.completeSetup(VALID)).toEqual({
      ok: false,
      error: "Setup is not available on this instance.",
    });
  });

  it("rejects invalid input", async () => {
    expect((await mod.completeSetup({ ...VALID, email: "not-an-email" })).ok).toBe(false);
  });

  it("rejects a wrong setup token", async () => {
    expect(await mod.completeSetup({ ...VALID, setupToken: "wrong" })).toEqual({
      ok: false,
      error: "Invalid setup token.",
    });
  });

  it("refuses once the instance is already set up", async () => {
    setupQueries.isInstanceSetup.mockResolvedValue(true);
    expect(await mod.completeSetup(VALID)).toEqual({
      ok: false,
      error: "This instance has already been set up.",
    });
    expect(api.signUpEmail).not.toHaveBeenCalled();
  });

  it("creates a personal workspace in solo mode (delegating to Better Auth)", async () => {
    api.signUpEmail.mockResolvedValueOnce({ user: { id: "owner-x" } });
    api.signInEmail.mockResolvedValueOnce({ token: "sess-x" });
    api.createOrganization.mockResolvedValueOnce({ id: "org-x" });

    expect(await mod.completeSetup(VALID)).toEqual({ ok: true });
    expect(api.createOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ type: "personal" }) }),
    );
  });

  it("creates an organization workspace in org mode", async () => {
    instance.isPrivateSolo.mockReturnValue(false);
    api.signUpEmail.mockResolvedValueOnce({ user: { id: "owner-y" } });
    api.signInEmail.mockResolvedValueOnce({ token: "sess-y" });
    api.createOrganization.mockResolvedValueOnce({ id: "org-y" });

    expect(await mod.completeSetup(VALID)).toEqual({ ok: true });
    expect(api.createOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ type: "organization" }) }),
    );
  });

  it("returns a friendly error if Better Auth sign-up fails", async () => {
    api.signUpEmail.mockRejectedValueOnce(new Error("email taken"));
    expect(await mod.completeSetup(VALID)).toEqual({ ok: false, error: "email taken" });
  });
});

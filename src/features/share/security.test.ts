// DB-gated security tests for sharing (Phase 6.5). They drive the REAL share
// queries/actions against a real Postgres, asserting the boundaries that protect
// career data: a revoked token is dead, private brags never reach a share (payload
// OR attachment), the password gate locks content and rate-limits attempts, and
// the one-active-link invariant holds. The auth guard is mocked (owner actions run
// outside a request) and next/headers cookies() is backed by an in-memory jar so
// the unlock cookie round-trips.
//
// Skipped when DATABASE_URL is unset, so the default `verify` Vitest job stays
// DB-free (importing @/lib/env throws without it — hence the lazy imports). The CI
// `database` job sets DATABASE_URL to un-skip it. Locally:
//   pnpm dev:up && DATABASE_URL=postgres://bragbit:bragbit@localhost:5433/bragbit \
//     BETTER_AUTH_SECRET=0123456789abcdef0123456789abcdef pnpm test src/features/share/security.test.ts
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

// The owner the mocked guard reports (set by seed()); the public share functions
// ignore it, the owner actions (createShareLink/setSharePassword) rely on it.
const authCtx = vi.hoisted(() => ({ workspaceId: "", userId: "" }));
vi.mock("@/lib/auth/guards", () => ({
  requireWorkspace: async () => ({
    workspaceId: authCtx.workspaceId,
    user: { id: authCtx.userId },
  }),
}));

// In-memory cookie jar so isShareUnlocked / setShareUnlockCookie round-trip.
const cookieJar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

async function load() {
  const [dbMod, schema, queries, actions, unlock, rateLimit, argon2, drizzle] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db/schema"),
    import("./queries"),
    import("./actions"),
    import("./unlock"),
    import("@/lib/rate-limit"),
    import("@node-rs/argon2"),
    import("drizzle-orm"),
  ]);
  return {
    db: dbMod.db,
    schema,
    getSharedView: queries.getSharedView,
    getSharedAttachmentByKey: queries.getSharedAttachmentByKey,
    getShareCredentials: queries.getShareCredentials,
    createShareLink: actions.createShareLink,
    setSharePassword: actions.setSharePassword,
    removeSharePassword: actions.removeSharePassword,
    unlockShare: actions.unlockShare,
    isShareUnlocked: unlock.isShareUnlocked,
    resetRateLimit: rateLimit.resetRateLimit,
    hash: argon2.hash,
    and: drizzle.and,
    eq: drizzle.eq,
    isNull: drizzle.isNull,
    inArray: drizzle.inArray,
  };
}

describe.skipIf(!hasDb)("share security", () => {
  let mod: Awaited<ReturnType<typeof load>>;
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    mod = await load();
  });

  /** Seed an owner + workspace + document with one SHARED and one PRIVATE brag,
   *  each carrying an attachment, and point the mocked guard at the owner. */
  async function seed(sfx: string) {
    const { db, schema } = mod;
    const ws = `sec-ws-${sfx}`;
    const uid = `sec-user-${sfx}`;
    const ids = {
      ws,
      uid,
      docId: `sec-doc-${sfx}`,
      bragShared: `sec-bragS-${sfx}`,
      bragPrivate: `sec-bragP-${sfx}`,
      keyShared: `${ws}/attachments/shared-${sfx}.png`,
      keyPrivate: `${ws}/attachments/private-${sfx}.png`,
    };
    await db.insert(schema.user).values({ id: uid, name: "Sec User", email: `${uid}@test.local` });
    await db.insert(schema.organization).values({ id: ws, name: `Sec ${sfx}`, slug: ws });
    await db
      .insert(schema.document)
      .values({ id: ids.docId, workspaceId: ws, userId: uid, title: "Year" });
    await db.insert(schema.brag).values([
      { id: ids.bragShared, documentId: ids.docId, title: "Shared win", visibility: "shared" },
      { id: ids.bragPrivate, documentId: ids.docId, title: "Private win", visibility: "private" },
    ]);
    const att = (bragId: string, storageKey: string, fileName: string) => ({
      bragId,
      storageKey,
      fileName,
      mimeType: "image/png",
      sizeBytes: 1,
    });
    await db
      .insert(schema.attachment)
      .values([
        att(ids.bragShared, ids.keyShared, "shared.png"),
        att(ids.bragPrivate, ids.keyPrivate, "private.png"),
      ]);
    createdOrgIds.push(ws);
    createdUserIds.push(uid);
    authCtx.workspaceId = ws;
    authCtx.userId = uid;
    return ids;
  }

  async function insertLink(opts: {
    id: string;
    documentId: string;
    token: string;
    passwordHash?: string;
    revoked?: boolean;
  }) {
    await mod.db.insert(mod.schema.shareLink).values({
      id: opts.id,
      documentId: opts.documentId,
      token: opts.token,
      passwordHash: opts.passwordHash ?? null,
      revokedAt: opts.revoked ? new Date() : null,
    });
  }

  afterEach(async () => {
    const { db, schema, inArray } = mod;
    cookieJar.clear();
    // Deleting the user/org cascades documents → brags → attachments → share_links.
    if (createdUserIds.length)
      await db.delete(schema.user).where(inArray(schema.user.id, createdUserIds));
    if (createdOrgIds.length)
      await db.delete(schema.organization).where(inArray(schema.organization.id, createdOrgIds));
    createdUserIds.length = 0;
    createdOrgIds.length = 0;
    authCtx.workspaceId = "";
    authCtx.userId = "";
  });

  afterAll(async () => {
    await (
      globalThis as { __bragbitClient?: { end?: (o?: unknown) => Promise<void> } }
    ).__bragbitClient
      ?.end?.({ timeout: 5 })
      .catch(() => {});
  });

  it("an open share exposes only shared brags and their attachments — never private ones", async () => {
    const s = await seed("vis");
    await insertLink({ id: "sl-vis", documentId: s.docId, token: "tok-vis" });

    const view = await mod.getSharedView("tok-vis");
    expect(view?.state).toBe("open");
    if (view?.state !== "open") throw new Error("expected open");
    expect(view.brags.map((b) => b.id)).toEqual([s.bragShared]); // private absent
    expect(view.brags).toHaveLength(1);

    // The shared brag's attachment is reachable by the token…
    const shared = await mod.getSharedAttachmentByKey(s.keyShared, "tok-vis");
    expect(shared?.storageKey).toBe(s.keyShared);
    // …the PRIVATE brag's attachment is not, even with the valid token.
    expect(await mod.getSharedAttachmentByKey(s.keyPrivate, "tok-vis")).toBeNull();
  });

  it("a revoked token is dead — no view, no attachments", async () => {
    const s = await seed("rev");
    await insertLink({ id: "sl-rev", documentId: s.docId, token: "tok-rev", revoked: true });

    expect(await mod.getSharedView("tok-rev")).toBeNull();
    expect(await mod.getSharedAttachmentByKey(s.keyShared, "tok-rev")).toBeNull();
  });

  it("an unknown token resolves to nothing", async () => {
    const s = await seed("unknown");
    expect(await mod.getSharedView("no-such-token")).toBeNull();
    expect(await mod.getSharedAttachmentByKey(s.keyShared, "no-such-token")).toBeNull();
  });

  it("a password-protected share is locked until the right password unlocks it", async () => {
    const s = await seed("pw");
    const pwHash = await mod.hash("secret123");
    await insertLink({ id: "sl-pw", documentId: s.docId, token: "tok-pw", passwordHash: pwHash });

    // Locked: the view carries no document or brags (cookie jar is empty).
    const locked = await mod.getSharedView("tok-pw");
    expect(locked?.state).toBe("locked");
    expect(locked && "brags" in locked).toBe(false);

    // The attachment gate's predicate (what the file route checks) is closed.
    const cred = await mod.getShareCredentials("tok-pw");
    expect(cred?.id).toBe("sl-pw");
    expect(await mod.isShareUnlocked("sl-pw", pwHash)).toBe(false);

    // Wrong password is rejected; correct password unlocks and sets the cookie.
    expect(await mod.unlockShare("tok-pw", "nope")).toEqual({ ok: false, code: "incorrect" });
    expect(await mod.unlockShare("tok-pw", "secret123")).toEqual({ ok: true });

    expect(await mod.isShareUnlocked("sl-pw", pwHash)).toBe(true);
    const unlocked = await mod.getSharedView("tok-pw");
    expect(unlocked?.state).toBe("open");
    if (unlocked?.state === "open") expect(unlocked.brags.map((b) => b.id)).toEqual([s.bragShared]);
  });

  it("unlock attempts are rate-limited per share", async () => {
    const s = await seed("rate");
    const pwHash = await mod.hash("secret123");
    await insertLink({
      id: "sl-rate",
      documentId: s.docId,
      token: "tok-rate",
      passwordHash: pwHash,
    });
    await mod.resetRateLimit("share-unlock:sl-rate");

    for (let i = 0; i < 5; i++) {
      expect(await mod.unlockShare("tok-rate", "wrong")).toEqual({ ok: false, code: "incorrect" });
    }
    // The 6th attempt is blocked before the password is even checked.
    expect(await mod.unlockShare("tok-rate", "wrong")).toEqual({ ok: false, code: "rate" });
  });

  it("keeps one active link per document — create is idempotent, a second active insert is rejected", async () => {
    const s = await seed("idem");
    const { db, schema, and, eq, isNull } = mod;

    const first = await mod.createShareLink(s.docId);
    const second = await mod.createShareLink(s.docId);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) expect(second.link.token).toBe(first.link.token); // same link

    const active = await db
      .select({ id: schema.shareLink.id })
      .from(schema.shareLink)
      .where(and(eq(schema.shareLink.documentId, s.docId), isNull(schema.shareLink.revokedAt)));
    expect(active).toHaveLength(1);

    // The partial unique index rejects a second active link outright.
    await expect(
      db.insert(schema.shareLink).values({ documentId: s.docId, token: "sneaky-second" }),
    ).rejects.toThrow();
  });

  it("the owner can set and remove a password (argon2-hashed, never stored clear)", async () => {
    const s = await seed("mgmt");
    const created = await mod.createShareLink(s.docId);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const token = created.link.token;

    expect(await mod.setSharePassword(s.docId, "short")).toMatchObject({ ok: false }); // min length
    expect(await mod.setSharePassword(s.docId, "longenough")).toEqual({ ok: true });

    const withPw = await mod.getShareCredentials(token);
    expect(withPw?.passwordHash).toMatch(/^\$argon2id\$/);

    expect(await mod.removeSharePassword(s.docId)).toEqual({ ok: true });
    const withoutPw = await mod.getShareCredentials(token);
    expect(withoutPw?.passwordHash).toBeNull();
  });
});

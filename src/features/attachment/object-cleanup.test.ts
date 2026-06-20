// DB-gated integration test for the orphan-attachment fix: deleting a brag or a
// document must purge its attachments' stored OBJECTS, not just cascade their
// rows. It drives the REAL deleteBrag / deleteDocument server actions against a
// real Postgres + the local-disk storage driver, mocking only the auth guard so
// they run outside a request.
//
// Skipped when DATABASE_URL is unset, so the default `verify` Vitest job stays
// DB-free (importing @/lib/env throws without it — hence the lazy imports below).
// The CI `database` job sets DATABASE_URL to un-skip it. Locally:
//   pnpm dev:up && DATABASE_URL=postgres://bragbit:bragbit@localhost:5433/bragbit \
//     BETTER_AUTH_SECRET=x pnpm test src/features/attachment/object-cleanup.test.ts
import { rm } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

// The active workspace/user the mocked guard reports; each test sets it before
// invoking an action (and flips userId to assert ownership scoping). Hoisted so
// the (hoisted) vi.mock factory can close over it.
const authCtx = vi.hoisted(() => ({ workspaceId: "", userId: "" }));
vi.mock("@/lib/auth/guards", () => ({
  requireWorkspace: async () => ({
    workspaceId: authCtx.workspaceId,
    user: { id: authCtx.userId },
  }),
}));

// App modules are imported lazily (inside the gated suite's hooks) so the DB-free
// `verify` job — where the suite is skipped — never evaluates @/lib/env.
async function load() {
  const [dbMod, schema, storageMod, bragMod, docMod, acctMod, drizzle] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db/schema"),
    import("@/lib/storage"),
    import("@/features/brag/actions"),
    import("@/features/document/actions"),
    import("@/features/account/deletion"),
    import("drizzle-orm"),
  ]);
  return {
    db: dbMod.db,
    schema,
    getStorage: storageMod.getStorage,
    deleteBrag: bragMod.deleteBrag,
    deleteDocument: docMod.deleteDocument,
    cleanupUserStorage: acctMod.cleanupUserStorage,
    inArray: drizzle.inArray,
  };
}

describe.skipIf(!hasDb)("attachment objects are purged when a brag/document is deleted", () => {
  let mod: Awaited<ReturnType<typeof load>>;
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdWsDirs: string[] = [];

  beforeAll(async () => {
    mod = await load();
  });

  /** Seed an owner + workspace + document with two brags (A has 2 attachments,
   *  B has 1), write the three objects to disk, and point the mocked guard at
   *  the owner. Returns the ids/keys for assertions. */
  async function seed(sfx: string) {
    const { db, schema, getStorage } = mod;
    const ws = `test-ws-${sfx}`;
    const uid = `test-user-${sfx}`;
    const ids = {
      ws,
      uid,
      docId: `test-doc-${sfx}`,
      bragA: `test-bragA-${sfx}`,
      bragB: `test-bragB-${sfx}`,
      keyA: `${ws}/attachments/a-${sfx}.txt`,
      keyB: `${ws}/attachments/b-${sfx}.txt`,
      keyC: `${ws}/attachments/c-${sfx}.txt`,
    };

    await db.insert(schema.user).values({ id: uid, name: "Test User", email: `${uid}@test.local` });
    await db.insert(schema.organization).values({ id: ws, name: `Test ${sfx}`, slug: ws });
    await db
      .insert(schema.document)
      .values({ id: ids.docId, workspaceId: ws, userId: uid, title: "Doc" });
    await db.insert(schema.brag).values([
      { id: ids.bragA, documentId: ids.docId, title: "Brag A" },
      { id: ids.bragB, documentId: ids.docId, title: "Brag B" },
    ]);
    const att = (bragId: string, storageKey: string, fileName: string) => ({
      bragId,
      storageKey,
      fileName,
      mimeType: "text/plain",
      sizeBytes: 1,
    });
    await db
      .insert(schema.attachment)
      .values([
        att(ids.bragA, ids.keyA, "a.txt"),
        att(ids.bragA, ids.keyB, "b.txt"),
        att(ids.bragB, ids.keyC, "c.txt"),
      ]);

    const storage = getStorage();
    await storage.put(ids.keyA, Buffer.from("A"));
    await storage.put(ids.keyB, Buffer.from("B"));
    await storage.put(ids.keyC, Buffer.from("C"));

    createdOrgIds.push(ws);
    createdUserIds.push(uid);
    createdWsDirs.push(path.join(process.env.STORAGE_DIR ?? "./.data/uploads", ws));
    authCtx.workspaceId = ws;
    authCtx.userId = uid;
    return ids;
  }

  /** Whether a stored object still exists. */
  const exists = (key: string) =>
    mod
      .getStorage()
      .get(key)
      .then(
        () => true,
        () => false,
      );

  afterEach(async () => {
    const { db, schema, inArray } = mod;
    for (const dir of createdWsDirs)
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    // Deleting the user/org cascades documents → brags → attachment rows.
    if (createdUserIds.length)
      await db.delete(schema.user).where(inArray(schema.user.id, createdUserIds));
    if (createdOrgIds.length)
      await db.delete(schema.organization).where(inArray(schema.organization.id, createdOrgIds));
    createdWsDirs.length = 0;
    createdUserIds.length = 0;
    createdOrgIds.length = 0;
    authCtx.workspaceId = "";
    authCtx.userId = "";
  });

  afterAll(async () => {
    // Close the pooled postgres client so Vitest can exit cleanly.
    await (
      globalThis as { __bragbitClient?: { end?: (o?: unknown) => Promise<void> } }
    ).__bragbitClient
      ?.end?.({ timeout: 5 })
      .catch(() => {});
  });

  it("deleteDocument cascades the rows AND purges every attachment object", async () => {
    const { db, schema, inArray, deleteDocument } = mod;
    const s = await seed("doc");
    expect(await exists(s.keyA)).toBe(true);

    expect(await deleteDocument(s.docId)).toEqual({ ok: true });

    // rows cascaded away
    expect(
      await db
        .select({ id: schema.brag.id })
        .from(schema.brag)
        .where(inArray(schema.brag.id, [s.bragA, s.bragB])),
    ).toEqual([]);
    expect(
      await db
        .select({ id: schema.attachment.id })
        .from(schema.attachment)
        .where(inArray(schema.attachment.storageKey, [s.keyA, s.keyB, s.keyC])),
    ).toEqual([]);
    // objects gone from storage (the bug this fix closes)
    expect(await exists(s.keyA)).toBe(false);
    expect(await exists(s.keyB)).toBe(false);
    expect(await exists(s.keyC)).toBe(false);
  });

  it("deleteBrag purges only that brag's objects; a sibling brag's object survives", async () => {
    const { deleteBrag } = mod;
    const s = await seed("brag");

    expect(await deleteBrag(s.bragA)).toEqual({ ok: true });

    expect(await exists(s.keyA)).toBe(false);
    expect(await exists(s.keyB)).toBe(false);
    expect(await exists(s.keyC)).toBe(true); // belongs to bragB, untouched
  });

  it("does not purge objects when the caller doesn't own the brag", async () => {
    const { deleteBrag } = mod;
    const s = await seed("owner");

    authCtx.userId = "someone-else"; // not the owner
    expect(await deleteBrag(s.bragA)).toEqual({ ok: false, error: "Brag not found." });

    // ownership-scoped: nothing removed from storage
    expect(await exists(s.keyA)).toBe(true);
    expect(await exists(s.keyB)).toBe(true);
  });

  it("account deletion purges the user's attachments + avatar and drops the sole-member workspace", async () => {
    const { db, schema, getStorage, cleanupUserStorage, inArray } = mod;
    const s = await seed("acct");
    // Make the user the sole member of the workspace + give them an avatar object,
    // so cleanupUserStorage exercises the org-drop and avatar paths too.
    await db
      .insert(schema.member)
      .values({ id: `test-mem-acct`, organizationId: s.ws, userId: s.uid, role: "owner" });
    const avatarKey = `${s.ws}/avatars/av-acct.png`;
    await db.insert(schema.profile).values({ userId: s.uid, displayName: "Test User", avatarKey });
    await getStorage().put(avatarKey, Buffer.from("AV"));
    expect(await exists(avatarKey)).toBe(true);
    expect(await exists(s.keyA)).toBe(true);

    // Runs the same cleanup the deleteUser beforeDelete hook does, BEFORE the row
    // cascade. It drops the org (cascading documents → brags → attachment rows).
    await cleanupUserStorage(s.uid);

    // workspace row dropped, attachment rows cascaded away
    expect(
      await db
        .select({ id: schema.organization.id })
        .from(schema.organization)
        .where(inArray(schema.organization.id, [s.ws])),
    ).toEqual([]);
    expect(
      await db
        .select({ id: schema.attachment.id })
        .from(schema.attachment)
        .where(inArray(schema.attachment.storageKey, [s.keyA, s.keyB, s.keyC])),
    ).toEqual([]);
    // every stored object purged — the orphan-file bug this fix closes
    expect(await exists(s.keyA)).toBe(false);
    expect(await exists(s.keyB)).toBe(false);
    expect(await exists(s.keyC)).toBe(false);
    expect(await exists(avatarKey)).toBe(false);
  });
});

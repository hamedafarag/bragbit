// Cross-workspace DATA-ISOLATION suite (PLAN.md §10, item 7 — the security-critical
// hosted-multi-tenant deliverable). It seeds TWO complete, independent workspaces
// (each: org + owner + document + a shared & a private brag, attachments, a tag, and
// a share link) against a real Postgres, then drives the REAL queries / server
// actions / route handlers as one workspace's owner against the OTHER workspace's
// resources — asserting every cross-tenant access fails (null / "not found" / [] /
// 404). Each boundary also gets a positive control (the rightful owner CAN reach it)
// so a deny can never pass vacuously.
//
// This lives in src/test/ rather than a feature dir because it deliberately spans
// every content surface (documents · brags · search · attachments · share-links ·
// export · the file route · dashboard) — it's the tenancy contract, not one feature's
// test. The boundary it locks is the DAL's `(workspaceId, userId)` WHERE-scoping
// (documents are private PER USER, even within a shared org), so the guard is mocked
// (these run outside a request) and isolation is proven at the query layer that every
// route and action funnels through.
//
// Skipped unless DATABASE_URL is set (importing @/lib/env throws without it — hence
// the lazy imports), so the default DB-free `pnpm test` stays green; CI's `dal` job
// and `pnpm test:db` un-skip it. Locally:
//   pnpm dev:up && pnpm test:db src/test/data-isolation.test.ts
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Type-only (erased at runtime, so they never load @/lib/env) — just to type the
// fully-valid payloads the mutating actions need to get PAST input validation and
// reach the ownership boundary under test.
import type { BragInput } from "@/features/brag/schema";
import type { DocumentInput } from "@/features/document/schema";

const hasDb = Boolean(process.env.DATABASE_URL);

// `updateDocument` / `updateBrag` validate input with Zod BEFORE the ownership-scoped
// WHERE runs, so reaching the "…not found" cross-tenant boundary needs a payload that
// passes validation. `satisfies` keeps the literal types (no widening) assignable.
const VALID_DOC = {
  title: "Hijacked",
  description: "",
  periodStart: "",
  periodEnd: "",
  goalsMd: "",
} satisfies DocumentInput;

const VALID_BRAG = {
  title: "Hijack attempt",
  date: "2026-06-01",
  category: "shipped-work",
  status: "shipped",
  descriptionMd: "",
  impactMd: "",
  collaborators: "",
  attribution: "",
  links: [],
  tags: [],
  visibility: "shared",
} satisfies BragInput;

// The actor the mocked guards report — flipped per assertion to impersonate either
// workspace's owner (or an anonymous visitor, when userId is "").
const authCtx = vi.hoisted(() => ({ workspaceId: "", userId: "" }));

vi.mock("@/lib/auth/guards", () => {
  const ctx = () => ({
    workspaceId: authCtx.workspaceId,
    user: { id: authCtx.userId },
    session: { activeOrganizationId: authCtx.workspaceId },
    member: { role: "owner" as const },
  });
  return {
    requireWorkspace: async () => ctx(),
    getWorkspaceOrNull: async () => (authCtx.workspaceId && authCtx.userId ? ctx() : null),
    getSessionOrNull: async () =>
      authCtx.userId ? { user: { id: authCtx.userId }, session: {} } : null,
    // Avatars only (not exercised here) — the attachment paths scope by owner.
    isWorkspaceMember: async () => false,
  };
});

// The file route serves bytes through the storage adapter; stub it so the ALLOW
// (200) controls don't need real object storage. DENY paths 404 before storage is
// ever touched, so this never masks an isolation failure.
vi.mock("@/lib/storage", () => ({
  contentTypeForKey: () => "image/png",
  getStorage: () => ({
    get: async () => Buffer.from([0]),
    stat: async () => ({ size: 1 }),
    stream: async () =>
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([0]));
          controller.close();
        },
      }),
    delete: async () => {},
  }),
}));

// Force the file route onto its non-thumbnail path deterministically (and keep
// `sharp` out of the test) — isolation is independent of image processing.
vi.mock("@/lib/image", () => ({
  parseThumbWidth: () => null,
  isThumbnailable: () => false,
  thumbnail: async (b: Buffer) => b,
}));

async function load() {
  const [
    dbMod,
    schema,
    drizzle,
    documentQ,
    documentA,
    bragQ,
    bragA,
    attachmentQ,
    attachmentA,
    shareQ,
    shareA,
    exportQ,
    dashboardQ,
    filesRoute,
    exportRoute,
  ] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db/schema"),
    import("drizzle-orm"),
    import("@/features/document/queries"),
    import("@/features/document/actions"),
    import("@/features/brag/queries"),
    import("@/features/brag/actions"),
    import("@/features/attachment/queries"),
    import("@/features/attachment/actions"),
    import("@/features/share/queries"),
    import("@/features/share/actions"),
    import("@/features/export/queries"),
    import("@/features/dashboard/queries"),
    import("@/app/api/files/[...key]/route"),
    import("@/app/api/export/[documentId]/route"),
  ]);
  return {
    db: dbMod.db,
    schema,
    eq: drizzle.eq,
    and: drizzle.and,
    inArray: drizzle.inArray,
    doc: { ...documentQ, ...documentA },
    brag: { ...bragQ, ...bragA },
    att: { ...attachmentQ, ...attachmentA },
    share: { ...shareQ, ...shareA },
    exp: exportQ,
    dash: dashboardQ,
    filesGET: filesRoute.GET,
    exportGET: exportRoute.GET,
  };
}

type Mod = Awaited<ReturnType<typeof load>>;
type Seeded = Awaited<ReturnType<ReturnType<typeof makeSeeder>>>;

/** Per-workspace fixture: distinctive, non-overlapping content so cross-tenant
 *  reads (esp. full-text search) are unambiguous. */
const FIXTURES = {
  a: {
    token: "iso-token-aaaaaaaaaaaaaaaaaaaa",
    tag: "alpha-tag-a",
    sharedWord: "zephyrcache",
    privateWord: "quasarbloom",
    sharedDate: "2026-05-01",
    privateDate: "2026-05-02",
  },
  b: {
    token: "iso-token-bbbbbbbbbbbbbbbbbbbb",
    tag: "beta-tag-b",
    sharedWord: "nimbusforge",
    privateWord: "voidspark",
    sharedDate: "2026-07-01",
    privateDate: "2026-07-02",
  },
} as const;

function makeSeeder(mod: Mod, track: { users: string[]; orgs: string[] }) {
  return async function seedWorkspace(sfx: keyof typeof FIXTURES) {
    const { db, schema } = mod;
    const f = FIXTURES[sfx];
    const ws = `iso-org-${sfx}`;
    const uid = `iso-user-${sfx}`;
    const ids = {
      ws,
      uid,
      email: `${uid}@iso.local`,
      doc: `iso-doc-${sfx}`,
      bragShared: `iso-bragS-${sfx}`,
      bragPrivate: `iso-bragP-${sfx}`,
      attShared: `iso-attS-${sfx}`,
      attPrivate: `iso-attP-${sfx}`,
      keyShared: `${ws}/attachments/shared-${sfx}.png`,
      keyPrivate: `${ws}/attachments/private-${sfx}.png`,
      shareLink: `iso-sl-${sfx}`,
      token: f.token,
      tag: f.tag,
      sharedWord: f.sharedWord,
      privateWord: f.privateWord,
      sharedDate: f.sharedDate,
      privateDate: f.privateDate,
    };
    await db.insert(schema.user).values({ id: uid, name: `User ${sfx}`, email: ids.email });
    await db.insert(schema.organization).values({ id: ws, name: `Iso ${sfx}`, slug: ws });
    await db
      .insert(schema.document)
      .values({ id: ids.doc, workspaceId: ws, userId: uid, title: `Doc ${sfx}` });
    await db.insert(schema.brag).values([
      {
        id: ids.bragShared,
        documentId: ids.doc,
        title: f.sharedWord,
        date: f.sharedDate,
        visibility: "shared",
      },
      {
        id: ids.bragPrivate,
        documentId: ids.doc,
        title: f.privateWord,
        date: f.privateDate,
        visibility: "private",
      },
    ]);
    await db.insert(schema.attachment).values([
      {
        id: ids.attShared,
        bragId: ids.bragShared,
        storageKey: ids.keyShared,
        fileName: `shared-${sfx}.png`,
        mimeType: "image/png",
        sizeBytes: 1,
      },
      {
        id: ids.attPrivate,
        bragId: ids.bragPrivate,
        storageKey: ids.keyPrivate,
        fileName: `private-${sfx}.png`,
        mimeType: "image/png",
        sizeBytes: 1,
      },
    ]);
    await db
      .insert(schema.shareLink)
      .values({ id: ids.shareLink, documentId: ids.doc, token: f.token });
    const [tagRow] = await db
      .insert(schema.tag)
      .values({ userId: uid, workspaceId: ws, name: f.tag })
      .returning({ id: schema.tag.id });
    await db.insert(schema.bragTag).values({ bragId: ids.bragShared, tagId: tagRow!.id });
    track.users.push(uid);
    track.orgs.push(ws);
    return ids;
  };
}

describe.skipIf(!hasDb)("cross-workspace data isolation", () => {
  let mod: Mod;
  let A: Seeded;
  let B: Seeded;
  const track = { users: [] as string[], orgs: [] as string[] };

  /** Impersonate a workspace owner (or, with no arg, an anonymous visitor). */
  function actAs(w?: Seeded) {
    authCtx.workspaceId = w?.ws ?? "";
    authCtx.userId = w?.uid ?? "";
  }

  function filesGET(key: string, query = "") {
    return mod.filesGET(new Request(`http://localhost/api/files/${key}${query}`), {
      params: Promise.resolve({ key: key.split("/") }),
    });
  }

  function exportGET(documentId: string) {
    return mod.exportGET(new Request(`http://localhost/api/export/${documentId}`), {
      params: Promise.resolve({ documentId }),
    });
  }

  beforeAll(async () => {
    mod = await load();
    const seed = makeSeeder(mod, track);
    A = await seed("a");
    B = await seed("b");
  });

  afterAll(async () => {
    const { db, schema, inArray } = mod;
    // Deleting users + orgs cascades documents → brags → links/tags/attachments/shares.
    if (track.users.length)
      await db.delete(schema.user).where(inArray(schema.user.id, track.users));
    if (track.orgs.length)
      await db.delete(schema.organization).where(inArray(schema.organization.id, track.orgs));
    await (
      globalThis as { __bragbitClient?: { end?: (o?: unknown) => Promise<void> } }
    ).__bragbitClient
      ?.end?.({ timeout: 5 })
      .catch(() => {});
  });

  // ── Documents ────────────────────────────────────────────────────────────────
  describe("documents", () => {
    it("a foreign document is unreadable and unlistable", async () => {
      actAs(A);
      expect((await mod.doc.getDocument(A.doc))?.id).toBe(A.doc); // owner: yes
      expect((await mod.doc.listDocuments()).map((d) => d.id)).toContain(A.doc);

      actAs(B);
      expect(await mod.doc.getDocument(A.doc)).toBeNull(); // attacker: no
      expect((await mod.doc.listDocuments()).map((d) => d.id)).not.toContain(A.doc);
    });

    it("a foreign document cannot be updated, archived, or deleted", async () => {
      const { db, schema, eq } = mod;
      actAs(B);
      const notFound = { ok: false, error: "Document not found." };
      expect(await mod.doc.updateDocument(A.doc, VALID_DOC)).toEqual(notFound);
      expect(await mod.doc.archiveDocument(A.doc)).toEqual(notFound);
      expect(await mod.doc.deleteDocument(A.doc)).toEqual(notFound);

      // The victim's row is untouched (still present, never archived).
      const [row] = await db.select().from(schema.document).where(eq(schema.document.id, A.doc));
      expect(row?.archivedAt ?? null).toBeNull();
      expect(row?.title).toBe("Doc a");
    });
  });

  // ── Brags & full-text search ───────────────────────────────────────────────────
  describe("brags & search", () => {
    it("foreign brags cannot be listed, counted, or tag-enumerated", async () => {
      actAs(A);
      expect((await mod.brag.listBrags(A.doc)).map((b) => b.id).sort()).toEqual(
        [A.bragShared, A.bragPrivate].sort(),
      );
      expect(await mod.brag.countDocumentBrags(A.doc)).toBe(2);
      expect(await mod.brag.listDocumentTags(A.doc)).toEqual([A.tag]);

      actAs(B);
      expect(await mod.brag.listBrags(A.doc)).toEqual([]);
      expect(await mod.brag.countDocumentBrags(A.doc)).toBe(0);
      expect(await mod.brag.listDocumentTags(A.doc)).toEqual([]);
    });

    it("a foreign brag cannot be created-into, updated, or deleted", async () => {
      const { db, schema, eq } = mod;
      actAs(B);
      expect(await mod.brag.quickAddBrag(A.doc, { title: "X", date: "2026-06-01" })).toEqual({
        ok: false,
        error: "Document not found.",
      });
      expect(await mod.brag.updateBrag(A.bragShared, { ...VALID_BRAG, title: "Hijack" })).toEqual({
        ok: false,
        error: "Brag not found.",
      });
      expect(await mod.brag.deleteBrag(A.bragShared)).toEqual({
        ok: false,
        error: "Brag not found.",
      });

      // No brag was added to A's document, and its shared brag survives intact.
      expect(await db.$count(schema.brag, eq(schema.brag.documentId, A.doc))).toBe(2);
      const [row] = await db.select().from(schema.brag).where(eq(schema.brag.id, A.bragShared));
      expect(row?.title).toBe(A.sharedWord);
    });

    it("full-text search never crosses tenants (the §10 search boundary)", async () => {
      actAs(A);
      // Owner finds their own — including a PRIVATE brag (search is the owner's view).
      expect((await mod.brag.searchBrags(A.sharedWord)).map((r) => r.id)).toContain(A.bragShared);
      expect((await mod.brag.searchBrags(A.privateWord)).map((r) => r.id)).toContain(A.bragPrivate);
      expect(await mod.brag.searchBrags(B.sharedWord)).toEqual([]); // can't see B's

      actAs(B);
      expect(await mod.brag.searchBrags(A.sharedWord)).toEqual([]); // can't see A's
      expect(await mod.brag.searchBrags(A.privateWord)).toEqual([]);
      expect((await mod.brag.searchBrags(B.sharedWord)).map((r) => r.id)).toContain(B.bragShared);
    });

    it("tag suggestions are per (user, workspace)", async () => {
      actAs(A);
      expect(await mod.brag.getTagSuggestions()).toEqual([A.tag]);
      actAs(B);
      expect(await mod.brag.getTagSuggestions()).toEqual([B.tag]);
    });
  });

  // ── Attachments ────────────────────────────────────────────────────────────────
  describe("attachments", () => {
    it("an attachment resolves only for its owner (the file-route owner predicate)", async () => {
      expect((await mod.att.getOwnedAttachmentByKey(A.keyShared, A.uid))?.storageKey).toBe(
        A.keyShared,
      );
      expect(await mod.att.getOwnedAttachmentByKey(A.keyShared, B.uid)).toBeNull();
      expect(await mod.att.getOwnedAttachmentByKey(A.keyPrivate, B.uid)).toBeNull();
    });

    it("ownership predicates and key-collection are tenant-scoped", async () => {
      expect(await mod.att.isBragOwnedBy(A.bragShared, A.ws, A.uid)).toBe(true);
      expect(await mod.att.isBragOwnedBy(A.bragShared, B.ws, B.uid)).toBe(false);

      expect((await mod.att.ownedAttachmentKeysForBrag(A.bragShared, A.ws, A.uid)).sort()).toEqual([
        A.keyShared,
      ]);
      expect(await mod.att.ownedAttachmentKeysForBrag(A.bragShared, B.ws, B.uid)).toEqual([]);
      expect((await mod.att.ownedAttachmentKeysForDocument(A.doc, A.ws, A.uid)).sort()).toEqual(
        [A.keyShared, A.keyPrivate].sort(),
      );
      expect(await mod.att.ownedAttachmentKeysForDocument(A.doc, B.ws, B.uid)).toEqual([]);
    });

    it("a foreign attachment cannot be deleted", async () => {
      const { db, schema, eq } = mod;
      actAs(B);
      expect(await mod.att.deleteAttachment(A.attShared)).toEqual({
        ok: false,
        error: "Attachment not found.",
      });
      // The victim's attachment row is still there.
      const [row] = await db
        .select()
        .from(schema.attachment)
        .where(eq(schema.attachment.id, A.attShared));
      expect(row?.storageKey).toBe(A.keyShared);
    });
  });

  // ── Share links: owner-side management ──────────────────────────────────────────
  describe("share links (owner operations)", () => {
    it("a foreign document's active link is invisible to non-owners", async () => {
      actAs(A);
      expect((await mod.share.getActiveShareLink(A.doc))?.token).toBe(A.token);
      actAs(B);
      expect(await mod.share.getActiveShareLink(A.doc)).toBeNull();
    });

    it("no share mutation reaches a foreign document; the victim's link is unchanged", async () => {
      const { db, schema, eq } = mod;
      actAs(B);
      const notFound = { ok: false, error: "Document not found." };
      expect(await mod.share.createShareLink(A.doc)).toEqual(notFound);
      expect(await mod.share.revokeShareLink(A.doc)).toEqual(notFound);
      expect(await mod.share.rotateShareLink(A.doc)).toEqual(notFound);
      expect(await mod.share.setSharePassword(A.doc, "longenough")).toEqual(notFound);
      expect(await mod.share.removeSharePassword(A.doc)).toEqual(notFound);

      // A still has exactly its one original active, password-less link.
      const links = await db
        .select()
        .from(schema.shareLink)
        .where(eq(schema.shareLink.documentId, A.doc));
      const stillActive = links.filter((r) => r.revokedAt == null);
      expect(stillActive).toHaveLength(1);
      expect(stillActive[0]!.token).toBe(A.token);
      expect(stillActive[0]!.passwordHash).toBeNull();
    });
  });

  // ── Share links: public, token-authorized reads ─────────────────────────────────
  describe("share links (public token)", () => {
    it("a token exposes only its own document's shared brags", async () => {
      const view = await mod.share.getSharedView(A.token);
      expect(view?.state).toBe("open");
      if (view?.state !== "open") throw new Error("expected open share");
      // Exactly A's shared brag — never A's private one, never anything from B.
      expect(view.brags.map((b) => b.id)).toEqual([A.bragShared]);
      expect(view.document.id).toBe(A.doc);
    });

    it("a token cannot fetch another workspace's attachment", async () => {
      // A's token resolves A's shared attachment…
      expect((await mod.share.getSharedAttachmentByKey(A.keyShared, A.token))?.storageKey).toBe(
        A.keyShared,
      );
      // …but never B's attachment, nor A's own PRIVATE one.
      expect(await mod.share.getSharedAttachmentByKey(B.keyShared, A.token)).toBeNull();
      expect(await mod.share.getSharedAttachmentByKey(A.keyPrivate, A.token)).toBeNull();
    });
  });

  // ── Export (the whole-document / whole-account egress surface) ───────────────────
  describe("export", () => {
    it("getDocumentForExport is null cross-tenant even with includePrivate", async () => {
      const ownScope = { workspaceId: A.ws, userId: A.uid };
      const foreignScope = { workspaceId: B.ws, userId: B.uid };
      const own = await mod.exp.getDocumentForExport(A.doc, ownScope, true);
      expect(own?.brags).toHaveLength(2); // owner gets shared + private
      expect(await mod.exp.getDocumentForExport(A.doc, foreignScope, true)).toBeNull();
    });

    it("getAllDataForExport returns only the scoped workspace's documents", async () => {
      const own = await mod.exp.getAllDataForExport({
        workspaceId: A.ws,
        userId: A.uid,
        email: A.email,
      });
      const foreign = await mod.exp.getAllDataForExport({
        workspaceId: B.ws,
        userId: B.uid,
        email: B.email,
      });
      expect(own.documents.map((d) => d.document.id)).toContain(A.doc);
      expect(foreign.documents.map((d) => d.document.id)).not.toContain(A.doc);
    });

    it("the export route 404s a foreign document and 200s the owner's", async () => {
      actAs(B);
      expect((await exportGET(A.doc)).status).toBe(404);
      actAs(A);
      expect((await exportGET(A.doc)).status).toBe(200);
    });
  });

  // ── The file route: the attachments HTTP boundary ────────────────────────────────
  describe("file route (/api/files)", () => {
    it("serves an owner their own attachment (session) — 200", async () => {
      actAs(A);
      expect((await filesGET(A.keyShared)).status).toBe(200);
    });

    it("serves a shared attachment via the document's own token — 200", async () => {
      actAs(); // anonymous visitor
      expect((await filesGET(A.keyShared, `?token=${A.token}`)).status).toBe(200);
    });

    it("404s a foreign user's attachment (cross-user session)", async () => {
      actAs(B);
      expect((await filesGET(A.keyShared)).status).toBe(404);
    });

    it("404s another workspace's attachment requested with a foreign token", async () => {
      actAs(); // anonymous
      // A valid token (A's) cannot be used to pull B's object.
      expect((await filesGET(B.keyShared, `?token=${A.token}`)).status).toBe(404);
      // …and A's own PRIVATE attachment never leaks through A's share token.
      expect((await filesGET(A.keyPrivate, `?token=${A.token}`)).status).toBe(404);
    });
  });

  // ── Dashboard activity (derived from brags) ──────────────────────────────────────
  describe("dashboard activity", () => {
    it("activity counts never include another tenant's days", async () => {
      const since = "2026-01-01";
      actAs(A);
      const aDates = new Set((await mod.dash.getActivityCounts(since)).map((c) => c.date));
      expect(aDates.has(A.sharedDate)).toBe(true);
      expect(aDates.has(B.sharedDate)).toBe(false);

      actAs(B);
      const bDates = new Set((await mod.dash.getActivityCounts(since)).map((c) => c.date));
      expect(bDates.has(B.sharedDate)).toBe(true);
      expect(bDates.has(A.sharedDate)).toBe(false);
      expect(bDates.has(A.privateDate)).toBe(false);
    });
  });
});

// Unit tests for the brag-attachment upload route. Auth, ownership, quota, storage,
// the db, env, and the MIME map are mocked, so every validation branch (401/400/404/
// 415/413/quota) and the success path run without a database. DB-free.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Ctx = { workspaceId: string; user: { id: string }; member: { role: string } } | null;
const ctx = vi.hoisted(() => ({ value: null as Ctx }));
const owned = vi.hoisted(() => ({ value: true }));
const overQuota = vi.hoisted(() => ({ value: false }));
const hosted = vi.hoisted(() => ({ value: false }));
const storage = vi.hoisted(() => ({ put: vi.fn(async () => {}), get: vi.fn(), delete: vi.fn() }));

vi.mock("@/lib/auth/guards", () => ({ getWorkspaceOrNull: async () => ctx.value }));
vi.mock("@/features/attachment/queries", () => ({ isBragOwnedBy: async () => owned.value }));
vi.mock("@/features/workspace/quota", () => ({ exceedsStorageQuota: async () => overQuota.value }));
vi.mock("@/lib/instance", () => ({ isHosted: () => hosted.value }));
vi.mock("@/lib/env", () => ({ env: { MAX_UPLOAD_MB: 1 } }));
vi.mock("@/lib/storage", () => ({
  getStorage: () => storage,
  ATTACHMENT_MIME_EXT: { "application/pdf": "pdf", "image/png": "png" },
}));

function makeChain(result: unknown): unknown {
  const p = Promise.resolve(result);
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return p.then.bind(p);
        if (prop === "catch") return p.catch.bind(p);
        if (prop === "finally") return p.finally.bind(p);
        return () => makeChain(result);
      },
    },
  );
}
vi.mock("@/lib/db", () => ({ db: { insert: () => makeChain([{ id: "att-1" }]) } }));

import { POST } from "./route";

function req(parts: { bragId?: string; files?: File[] }) {
  const fd = new FormData();
  if (parts.bragId !== undefined) fd.append("bragId", parts.bragId);
  for (const f of parts.files ?? []) fd.append("files", f);
  return new Request("http://localhost/api/upload/attachment", { method: "POST", body: fd });
}
const pdf = (size = 16) => new File([new Uint8Array(size)], "doc.pdf", { type: "application/pdf" });

beforeEach(() => {
  ctx.value = { workspaceId: "ws-1", user: { id: "u-1" }, member: { role: "member" } };
  owned.value = true;
  overQuota.value = false;
  hosted.value = false;
  storage.put.mockClear();
});

describe("POST /api/upload/attachment", () => {
  it("401s an unauthenticated caller", async () => {
    ctx.value = null;
    expect((await POST(req({ bragId: "b1", files: [pdf()] }))).status).toBe(401);
  });

  it("400s a missing brag id", async () => {
    expect((await POST(req({ files: [pdf()] }))).status).toBe(400);
  });

  it("400s when no files are attached", async () => {
    expect((await POST(req({ bragId: "b1" }))).status).toBe(400);
  });

  it("400s more than 20 files", async () => {
    const files = Array.from({ length: 21 }, () => pdf());
    expect((await POST(req({ bragId: "b1", files }))).status).toBe(400);
  });

  it("404s a brag the caller doesn't own", async () => {
    owned.value = false;
    expect((await POST(req({ bragId: "b1", files: [pdf()] }))).status).toBe(404);
  });

  it("415s an unsupported file type", async () => {
    const bad = new File([new Uint8Array(8)], "x.exe", { type: "application/x-msdownload" });
    expect((await POST(req({ bragId: "b1", files: [bad] }))).status).toBe(415);
  });

  it("413s a file over the size limit", async () => {
    expect((await POST(req({ bragId: "b1", files: [pdf(1024 * 1024 + 1)] }))).status).toBe(413);
  });

  it("413s when a hosted workspace is over its storage quota", async () => {
    hosted.value = true;
    overQuota.value = true;
    expect((await POST(req({ bragId: "b1", files: [pdf()] }))).status).toBe(413);
  });

  it("stores valid files and returns their metadata on success", async () => {
    const res = await POST(req({ bragId: "b1", files: [pdf()] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.attachments).toHaveLength(1);
    expect(body.attachments[0]).toMatchObject({ id: "att-1", mimeType: "application/pdf" });
    expect(storage.put).toHaveBeenCalledTimes(1);
  });
});

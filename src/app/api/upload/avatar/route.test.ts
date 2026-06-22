// Unit tests for the avatar upload route (any workspace member). Auth, storage, the
// db, and the image-MIME map are mocked, so every validation branch and the
// upsert/replace path run without a database. DB-free.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Ctx = { workspaceId: string; user: { id: string; name: string } } | null;
const ctx = vi.hoisted(() => ({ value: null as Ctx }));
const storage = vi.hoisted(() => ({
  put: vi.fn(async () => {}),
  delete: vi.fn(async () => {}),
  get: vi.fn(),
}));
const sel = vi.hoisted(() => ({ value: [] as { avatarKey: string | null }[] }));

vi.mock("@/lib/auth/guards", () => ({ getWorkspaceOrNull: async () => ctx.value }));
vi.mock("@/lib/storage", () => ({
  getStorage: () => storage,
  IMAGE_MIME_EXT: { "image/png": "png", "image/jpeg": "jpg" },
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
vi.mock("@/lib/db", () => ({
  db: { select: () => makeChain(sel.value), insert: () => makeChain([]) },
}));

import { POST } from "./route";

function reqWith(fields: Record<string, File | undefined>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) fd.append(k, v);
  return new Request("http://localhost/api/upload/avatar", { method: "POST", body: fd });
}
const png = (size = 16) => new File([new Uint8Array(size)], "me.png", { type: "image/png" });

beforeEach(() => {
  ctx.value = { workspaceId: "ws-1", user: { id: "u-1", name: "Ada" } };
  sel.value = [];
  storage.put.mockClear();
  storage.delete.mockClear();
});

describe("POST /api/upload/avatar", () => {
  it("401s an unauthenticated caller", async () => {
    ctx.value = null;
    expect((await POST(reqWith({ file: png() }))).status).toBe(401);
  });

  it("400s when no file is provided", async () => {
    expect((await POST(reqWith({}))).status).toBe(400);
  });

  it("415s an unsupported image type", async () => {
    const bad = new File([new Uint8Array(8)], "x.txt", { type: "text/plain" });
    expect((await POST(reqWith({ file: bad }))).status).toBe(415);
  });

  it("413s an oversized image", async () => {
    expect((await POST(reqWith({ file: png(5 * 1024 * 1024 + 1) }))).status).toBe(413);
  });

  it("stores the avatar and returns its url on success", async () => {
    const res = await POST(reqWith({ file: png() }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true });
    expect(body.url).toMatch(/^\/api\/files\/ws-1\/avatars\//);
    expect(storage.put).toHaveBeenCalledTimes(1);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("deletes the previous avatar when replacing it", async () => {
    sel.value = [{ avatarKey: "ws-1/avatars/old.png" }];
    await POST(reqWith({ file: png() }));
    expect(storage.delete).toHaveBeenCalledWith("ws-1/avatars/old.png");
  });
});

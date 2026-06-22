// Unit tests for the authorizing file-stream route. Storage, session/membership,
// share credentials, and the image helpers are mocked, so the branding (public),
// avatars (member), attachments (owner + share-token), thumbnail, and Range paths
// all run without a database. DB-free.
import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({ get: vi.fn(), stat: vi.fn(), stream: vi.fn() }));
const session = vi.hoisted(() => ({ value: null as { user: { id: string } } | null }));
const member = vi.hoisted(() => ({ value: true }));
const ownedAtt = vi.hoisted(() => ({
  value: null as { fileName: string; mimeType: string } | null,
}));
const sharedAtt = vi.hoisted(() => ({
  value: null as { fileName: string; mimeType: string } | null,
}));
const cred = vi.hoisted(() => ({
  value: null as { id: string; passwordHash: string | null } | null,
}));
const unlocked = vi.hoisted(() => ({ value: true }));
const thumbWidth = vi.hoisted(() => ({ value: null as number | null }));
const thumbFails = vi.hoisted(() => ({ value: false }));

vi.mock("@/lib/storage", () => ({
  getStorage: () => storage,
  contentTypeForKey: () => "image/png",
}));
vi.mock("@/lib/image", () => ({
  parseThumbWidth: () => thumbWidth.value,
  isThumbnailable: () => true,
  thumbnail: async () => {
    if (thumbFails.value) throw new Error("sharp failed");
    return Buffer.from("thumb");
  },
}));
vi.mock("@/lib/auth/guards", () => ({
  getSessionOrNull: async () => session.value,
  isWorkspaceMember: async () => member.value,
}));
vi.mock("@/features/attachment/queries", () => ({
  getOwnedAttachmentByKey: async () => ownedAtt.value,
}));
vi.mock("@/features/share/queries", () => ({
  getShareCredentials: async () => cred.value,
  getSharedAttachmentByKey: async () => sharedAtt.value,
}));
vi.mock("@/features/share/unlock", () => ({ isShareUnlocked: async () => unlocked.value }));

import { GET } from "./route";

const ATT = { fileName: "doc.pdf", mimeType: "application/pdf" };

function call(segments: string[], opts: { query?: string; range?: string } = {}) {
  const url = `http://localhost/api/files/${segments.join("/")}${opts.query ?? ""}`;
  const request = new Request(url, opts.range ? { headers: { range: opts.range } } : undefined);
  return GET(request, { params: Promise.resolve({ key: segments }) });
}

beforeEach(() => {
  storage.get.mockResolvedValue(Buffer.from(new Uint8Array(10)));
  storage.stat.mockResolvedValue({ size: 100 });
  storage.stream.mockResolvedValue(new Uint8Array([1, 2, 3]));
  session.value = null;
  member.value = true;
  ownedAtt.value = null;
  sharedAtt.value = null;
  cred.value = null;
  unlocked.value = true;
  thumbWidth.value = null;
  thumbFails.value = false;
});

describe("GET /api/files/[...key]", () => {
  it("404s too-few segments or a traversal attempt", async () => {
    expect((await call(["ws", "branding"])).status).toBe(404);
    expect((await call(["ws", "branding", ".."])).status).toBe(404);
  });

  it("serves a branding object publicly", async () => {
    const res = await call(["ws", "branding", "logo.png"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("public");
    expect(storage.get).toHaveBeenCalled();
  });

  it("404s a missing branding object", async () => {
    storage.get.mockRejectedValue(new Error("gone"));
    expect((await call(["ws", "branding", "logo.png"])).status).toBe(404);
  });

  it("serves a webp thumbnail for a ?w= branding request", async () => {
    thumbWidth.value = 200;
    const res = await call(["ws", "branding", "logo.png"], { query: "?w=200" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
  });

  it("falls back to the original when the thumbnail fails", async () => {
    thumbWidth.value = 200;
    thumbFails.value = true;
    const res = await call(["ws", "branding", "logo.png"], { query: "?w=200" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });

  it("401s an avatar request without a session", async () => {
    expect((await call(["ws", "avatars", "a.png"])).status).toBe(401);
  });

  it("404s an avatar for a non-member", async () => {
    session.value = { user: { id: "u1" } };
    member.value = false;
    expect((await call(["ws", "avatars", "a.png"])).status).toBe(404);
  });

  it("serves an avatar to a workspace member", async () => {
    session.value = { user: { id: "u1" } };
    const res = await call(["ws", "avatars", "a.png"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("private");
  });

  it("serves an owned attachment to its owner", async () => {
    session.value = { user: { id: "u1" } };
    ownedAtt.value = ATT;
    const res = await call(["ws", "attachments", "f.pdf"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
    expect(res.headers.get("Content-Disposition")).toContain("doc.pdf");
  });

  it("honors a Range request with a 206", async () => {
    session.value = { user: { id: "u1" } };
    ownedAtt.value = ATT;
    const res = await call(["ws", "attachments", "f.pdf"], { range: "bytes=0-9" });
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 0-9/100");
    expect(storage.stream).toHaveBeenCalledWith("ws/attachments/f.pdf", { start: 0, end: 9 });
  });

  it("serves a shared attachment via a valid open token", async () => {
    cred.value = { id: "share-1", passwordHash: null };
    sharedAtt.value = ATT;
    const res = await call(["ws", "attachments", "f.pdf"], { query: "?token=tok" });
    expect(res.status).toBe(200);
  });

  it("404s a share attachment behind a locked password gate", async () => {
    cred.value = { id: "share-1", passwordHash: "hashed" };
    unlocked.value = false;
    sharedAtt.value = ATT;
    expect((await call(["ws", "attachments", "f.pdf"], { query: "?token=tok" })).status).toBe(404);
  });

  it("404s an attachment with neither a session nor a token", async () => {
    expect((await call(["ws", "attachments", "f.pdf"])).status).toBe(404);
  });

  it("404s an unknown kind", async () => {
    expect((await call(["ws", "mystery", "f.bin"])).status).toBe(404);
  });
});

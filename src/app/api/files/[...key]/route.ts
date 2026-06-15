import { NextResponse } from "next/server";

import { getOwnedAttachmentByKey, type AttachmentRow } from "@/features/attachment/queries";
import { getSessionOrNull, isWorkspaceMember } from "@/lib/auth/guards";
import { contentTypeForKey, getStorage, type ByteRange, type Storage } from "@/lib/storage";

/**
 * Authorizing file stream. Keys are `${workspaceId}/${kind}/${file}`:
 *   - `branding/` (logos) — a deliberate public exception (PLAN.md §6): rendered
 *     on the login page and share pages before any session exists.
 *   - `avatars/` — any member of the key's workspace.
 *   - `attachments/` — the owner only (private per user, like brags), resolved via
 *     attachment → brag → document. Phase 6 adds a valid-share-token path.
 *   - anything else — 404.
 * URL segments are validated so they can never traverse the storage root.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[...key]">) {
  const { key: segments } = await ctx.params;

  if (segments.length < 3 || segments.some((s) => !s || s === "." || s === "..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const [workspaceId, kind] = segments;
  const key = segments.join("/");
  const storage = getStorage();

  if (kind === "branding") {
    return serveBuffered(storage, key, "public, max-age=300");
  }

  if (kind === "avatars") {
    const data = await getSessionOrNull();
    if (!data) return new NextResponse("Unauthorized", { status: 401 });
    if (!(await isWorkspaceMember(data.user.id, workspaceId))) {
      return new NextResponse("Not found", { status: 404 });
    }
    return serveBuffered(storage, key, "private, max-age=300");
  }

  if (kind === "attachments") {
    const data = await getSessionOrNull();
    if (!data) return new NextResponse("Unauthorized", { status: 401 });
    const att = await getOwnedAttachmentByKey(key, data.user.id);
    if (!att) return new NextResponse("Not found", { status: 404 });
    return serveRanged(request, storage, key, att);
  }

  return new NextResponse("Not found", { status: 404 });
}

/** Whole-object response for small files (logos, avatars). */
async function serveBuffered(storage: Storage, key: string, cacheControl: string) {
  try {
    const body = await storage.get(key);
    // Buffer isn't structurally a DOM BodyInit; a plain Uint8Array view is.
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": contentTypeForKey(key),
        "Content-Length": String(body.length),
        "Cache-Control": cacheControl,
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

/** Streamed response for attachments, honoring a `Range` request for large files. */
async function serveRanged(request: Request, storage: Storage, key: string, att: AttachmentRow) {
  let size: number;
  try {
    ({ size } = await storage.stat(key));
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  // Inline so images/PDFs preview; the filename* form carries non-ASCII names.
  const safeName = att.fileName.replace(/["\r\n]/g, "");
  const headers: Record<string, string> = {
    "Content-Type": att.mimeType || contentTypeForKey(key),
    "Content-Disposition": `inline; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(att.fileName)}`,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=300",
  };

  const range = parseRange(request.headers.get("range"), size);
  if (range) {
    const stream = await storage.stream(key, range);
    return new NextResponse(stream, {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
        "Content-Length": String(range.end - range.start + 1),
      },
    });
  }

  const stream = await storage.stream(key);
  return new NextResponse(stream, {
    status: 200,
    headers: { ...headers, "Content-Length": String(size) },
  });
}

/** Parse a single `bytes=` range against the object size; null if absent/unsatisfiable. */
function parseRange(header: string | null, size: number): ByteRange | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return null;

  let start: number;
  let end: number;
  if (rawStart === "") {
    // Suffix range: the last N bytes.
    const n = Number(rawEnd);
    if (n === 0) return null;
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  }
  if (start > end || start >= size) return null;
  return { start, end };
}

import { NextResponse } from "next/server";

import { getOwnedAttachmentByKey, type AttachmentRow } from "@/features/attachment/queries";
import { getShareCredentials, getSharedAttachmentByKey } from "@/features/share/queries";
import { isShareUnlocked } from "@/features/share/unlock";
import { getSessionOrNull, isWorkspaceMember } from "@/lib/auth/guards";
import { isThumbnailable, parseThumbWidth, thumbnail, type ThumbWidth } from "@/lib/image";
import { contentTypeForKey, getStorage, type ByteRange, type Storage } from "@/lib/storage";

/**
 * Authorizing file stream. Keys are `${workspaceId}/${kind}/${file}`:
 *   - `branding/` (logos) — a deliberate public exception (PLAN.md §6): rendered
 *     on the login page and share pages before any session exists.
 *   - `avatars/` — any member of the key's workspace.
 *   - `attachments/` — the owner (session, resolved via attachment → brag →
 *     document, private per user), or a valid `?token=` share whose document holds
 *     the brag and that brag is shared.
 *   - anything else — 404.
 * URL segments are validated so they can never traverse the storage root.
 */
// Params are typed explicitly rather than via the build-generated `RouteContext`,
// so `tsc --noEmit` passes on a clean checkout (before `next build` writes
// .next/types) — see AGENTS.md.
export async function GET(request: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key: segments } = await ctx.params;

  if (segments.length < 3 || segments.some((s) => !s || s === "." || s === "..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const [workspaceId, kind] = segments;
  const key = segments.join("/");
  const storage = getStorage();

  // A `?w=` request asks for a downscaled webp thumbnail (ENH-PERF-02); the width
  // must be on the allowlist or it's ignored (full object served as before).
  const width = parseThumbWidth(new URL(request.url).searchParams.get("w"));

  if (kind === "branding") {
    if (width) return serveThumb(storage, key, width, "public, max-age=300");
    return serveBuffered(storage, key, "public, max-age=300");
  }

  if (kind === "avatars") {
    const data = await getSessionOrNull();
    if (!data) return new NextResponse("Unauthorized", { status: 401 });
    if (!(await isWorkspaceMember(data.user.id, workspaceId))) {
      return new NextResponse("Not found", { status: 404 });
    }
    if (width) return serveThumb(storage, key, width, "private, max-age=300");
    return serveBuffered(storage, key, "private, max-age=300");
  }

  if (kind === "attachments") {
    // Owner (session) path: the attachment must resolve through brag → document
    // to this user. Private-per-user, so membership alone isn't enough.
    const data = await getSessionOrNull();
    if (data) {
      const att = await getOwnedAttachmentByKey(key, data.user.id);
      if (att) {
        if (width && isThumbnailable(att.mimeType)) {
          return serveThumb(storage, key, width, "private, max-age=300");
        }
        return serveRanged(request, storage, key, att);
      }
    }
    // Valid-share-token path (public, no session): the attachment's brag must be
    // SHARED and belong to the token's non-revoked document — and if that share is
    // password-protected, the request must carry a valid unlock cookie, so an
    // attachment never leaks past the password gate.
    const token = new URL(request.url).searchParams.get("token");
    if (token) {
      const cred = await getShareCredentials(token);
      const unlocked =
        cred && (!cred.passwordHash || (await isShareUnlocked(cred.id, cred.passwordHash)));
      if (unlocked) {
        const att = await getSharedAttachmentByKey(key, token);
        if (att) {
          if (width && isThumbnailable(att.mimeType)) {
            return serveThumb(storage, key, width, "private, max-age=300");
          }
          return serveRanged(request, storage, key, att);
        }
      }
    }
    // Don't distinguish "no auth" from "not yours" — a flat 404 leaks nothing.
    return new NextResponse("Not found", { status: 404 });
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

/**
 * Downscaled webp thumbnail for an image object (ENH-PERF-02). Buffers the
 * original (image objects are small), resizes through sharp, and serves webp —
 * falling back to the original bytes if sharp can't process it, 404 if the object
 * is gone.
 */
async function serveThumb(storage: Storage, key: string, width: ThumbWidth, cacheControl: string) {
  let original: Buffer;
  try {
    original = await storage.get(key);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    const thumb = await thumbnail(original, width);
    return new NextResponse(new Uint8Array(thumb), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(thumb.length),
        "Cache-Control": cacheControl,
      },
    });
  } catch {
    // Unsupported or corrupt image — serve the original rather than failing.
    return new NextResponse(new Uint8Array(original), {
      status: 200,
      headers: {
        "Content-Type": contentTypeForKey(key),
        "Content-Length": String(original.length),
        "Cache-Control": cacheControl,
      },
    });
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

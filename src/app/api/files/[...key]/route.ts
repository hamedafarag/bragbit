import { NextResponse } from "next/server";

import { getSessionOrNull, isWorkspaceMember } from "@/lib/auth/guards";
import { contentTypeForKey, getStorage } from "@/lib/storage";

/**
 * Authorizing file stream. Keys are `${workspaceId}/${kind}/${file}`:
 *   - `branding/` (logos) — a deliberate public exception (PLAN.md §6): rendered
 *     on the login page and share pages before any session exists.
 *   - `avatars/` — owner-session only; requires membership of the key's workspace.
 *   - anything else (attachments) — gated in Phase 4; 404 here for now.
 * URL segments are validated so they can never traverse the storage root.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/files/[...key]">) {
  const { key: segments } = await ctx.params;

  if (segments.length < 3 || segments.some((s) => !s || s === "." || s === "..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const [workspaceId, kind] = segments;

  if (kind === "avatars") {
    const data = await getSessionOrNull();
    if (!data) return new NextResponse("Unauthorized", { status: 401 });
    if (!(await isWorkspaceMember(data.user.id, workspaceId))) {
      return new NextResponse("Not found", { status: 404 });
    }
  } else if (kind !== "branding") {
    return new NextResponse("Not found", { status: 404 });
  }

  const key = segments.join("/");
  try {
    const body = await getStorage().get(key);
    // Buffer isn't structurally a DOM BodyInit; a plain Uint8Array view is.
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": contentTypeForKey(key),
        "Content-Length": String(body.length),
        "Cache-Control": kind === "branding" ? "public, max-age=300" : "private, max-age=300",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

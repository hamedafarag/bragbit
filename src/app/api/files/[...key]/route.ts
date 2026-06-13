import { NextResponse } from "next/server";

import { getSessionOrNull, isWorkspaceMember } from "@/lib/auth/guards";
import { contentTypeForKey, getStorage } from "@/lib/storage";

/**
 * Authorizing file stream. Keys are `${workspaceId}/${kind}/${file}`. Phase 1
 * serves only avatars and requires the caller to be a member of the key's
 * workspace; attachments (with owner / share-token auth) and public org-logo /
 * avatar serving land in Phase 4 / Phase 6. Never serve a key the caller can't
 * reach, and never let URL segments traverse the storage root.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/files/[...key]">) {
  const data = await getSessionOrNull();
  if (!data) return new NextResponse("Unauthorized", { status: 401 });

  const { key: segments } = await ctx.params;

  // Reject traversal up front (segments are already split on "/").
  if (segments.some((s) => !s || s === "." || s === "..")) {
    return new NextResponse("Not found", { status: 404 });
  }
  // Phase 1: avatars only — `${workspaceId}/avatars/${file}`.
  if (segments.length < 3 || segments[1] !== "avatars") {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!(await isWorkspaceMember(data.user.id, segments[0]))) {
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
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

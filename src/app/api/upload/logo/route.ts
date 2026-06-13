import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getWorkspaceOrNull } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { organization } from "@/lib/db/schema";
import { getStorage, IMAGE_MIME_EXT } from "@/lib/storage";

// Workspace logo upload (owner/admin only). Stored under the workspace's
// `branding/` prefix, which the file route serves publicly so logos render on
// the login page and (later) share pages. Kept small.
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const ctx = await getWorkspaceOrNull();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.member.role !== "owner" && ctx.member.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const ext = IMAGE_MIME_EXT[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Unsupported image type — use PNG, JPEG, WebP, or GIF." },
      { status: 415 },
    );
  }
  if (file.size > LOGO_MAX_BYTES) {
    return NextResponse.json({ error: "Logo must be 2 MB or smaller." }, { status: 413 });
  }

  const storage = getStorage();
  const key = `${ctx.workspaceId}/branding/logo-${crypto.randomUUID()}.${ext}`;
  await storage.put(key, Buffer.from(await file.arrayBuffer()), { contentType: file.type });

  const [prev] = await db
    .select({ logoKey: organization.logoKey })
    .from(organization)
    .where(eq(organization.id, ctx.workspaceId))
    .limit(1);

  await db.update(organization).set({ logoKey: key }).where(eq(organization.id, ctx.workspaceId));

  if (prev?.logoKey && prev.logoKey !== key) {
    await storage.delete(prev.logoKey).catch(() => {});
  }

  return NextResponse.json({ ok: true, key, url: `/api/files/${key}` });
}

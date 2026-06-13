import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getWorkspaceOrNull } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { profile } from "@/lib/db/schema";
import { getStorage, IMAGE_MIME_EXT } from "@/lib/storage";

// Avatars are small; cap independently of MAX_UPLOAD_MB (which governs Phase 4
// attachments). Keys are workspace-prefixed for isolation + quota accounting.
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const ctx = await getWorkspaceOrNull();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  if (file.size > AVATAR_MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 5 MB or smaller." }, { status: 413 });
  }

  const storage = getStorage();
  const key = `${ctx.workspaceId}/avatars/${crypto.randomUUID()}.${ext}`;
  await storage.put(key, Buffer.from(await file.arrayBuffer()), { contentType: file.type });

  // Swap the stored key, then best-effort delete the previous avatar file.
  const [prev] = await db
    .select({ avatarKey: profile.avatarKey })
    .from(profile)
    .where(eq(profile.userId, ctx.user.id))
    .limit(1);

  await db
    .insert(profile)
    .values({ userId: ctx.user.id, displayName: ctx.user.name, avatarKey: key })
    .onConflictDoUpdate({ target: profile.userId, set: { avatarKey: key } });

  if (prev?.avatarKey && prev.avatarKey !== key) {
    await storage.delete(prev.avatarKey).catch(() => {});
  }

  return NextResponse.json({ ok: true, key, url: `/api/files/${key}` });
}

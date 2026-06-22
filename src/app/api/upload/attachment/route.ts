import { NextResponse } from "next/server";

import { isBragOwnedBy } from "@/features/attachment/queries";
import { exceedsStorageQuota } from "@/features/workspace/quota";
import { getWorkspaceOrNull } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { attachment } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { isHosted } from "@/lib/instance";
import { ATTACHMENT_MIME_EXT, getStorage } from "@/lib/storage";

const MAX_FILES = 20;

/**
 * Multi-file attachment upload, scoped to a brag the caller owns. Files validate
 * against the MIME allowlist and MAX_UPLOAD_MB before anything is stored, so a
 * bad file rejects the whole request rather than leaving a partial upload. Keys
 * are workspace-prefixed under `attachments/`; objects are private (served only
 * by the authorizing file route).
 */
export async function POST(request: Request) {
  const ctx = await getWorkspaceOrNull();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const bragId = String(form.get("bragId") ?? "");
  const files = form.getAll("files").filter((f): f is File => f instanceof File);

  if (!bragId) return NextResponse.json({ error: "Missing brag." }, { status: 400 });
  if (files.length === 0)
    return NextResponse.json({ error: "No files provided." }, { status: 400 });
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Up to ${MAX_FILES} files at a time.` }, { status: 400 });
  }
  if (!(await isBragOwnedBy(bragId, ctx.workspaceId, ctx.user.id))) {
    return NextResponse.json({ error: "Brag not found." }, { status: 404 });
  }

  // Validate everything up front so a bad file doesn't leave a partial upload.
  const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
  for (const file of files) {
    if (!ATTACHMENT_MIME_EXT[file.type]) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.name || file.type}` },
        { status: 415 },
      );
    }
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `${file.name} exceeds the ${env.MAX_UPLOAD_MB} MB limit.` },
        { status: 413 },
      );
    }
  }

  // Per-workspace storage quota (hosted abuse control, PLAN §10): the instance
  // default (WORKSPACE_QUOTA_MB) or a /super per-workspace override caps total
  // attachment storage. The private modes don't enforce it.
  if (isHosted()) {
    const incoming = files.reduce((sum, file) => sum + file.size, 0);
    if (await exceedsStorageQuota(ctx.workspaceId, incoming)) {
      return NextResponse.json(
        { error: "This workspace has reached its storage quota." },
        { status: 413 },
      );
    }
  }

  const storage = getStorage();
  const created = [];
  for (const file of files) {
    const ext = ATTACHMENT_MIME_EXT[file.type];
    const key = `${ctx.workspaceId}/attachments/${crypto.randomUUID()}.${ext}`;
    await storage.put(key, Buffer.from(await file.arrayBuffer()), { contentType: file.type });

    const fileName = (file.name || `file.${ext}`).slice(0, 255);
    const [row] = await db
      .insert(attachment)
      .values({ bragId, storageKey: key, fileName, mimeType: file.type, sizeBytes: file.size })
      .returning({ id: attachment.id });

    created.push({
      id: row!.id,
      fileName,
      mimeType: file.type,
      sizeBytes: file.size,
      url: `/api/files/${key}`,
    });
  }

  return NextResponse.json({ ok: true, attachments: created });
}

import { NextResponse } from "next/server";

import { documentToMarkdown } from "@/features/export/markdown";
import { getDocumentForExport } from "@/features/export/queries";
import { getWorkspaceOrNull } from "@/lib/auth/guards";

/** A safe download filename from the document title (slug + extension). */
function filenameFor(title: string, ext: string): string {
  const base =
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "document";
  return `${base}.${ext}`;
}

/**
 * Export a document the caller owns. Owner-only (non-redirecting guard → 401, the
 * route-handler convention); the query is scoped by workspace + user, so an
 * unowned/missing id 404s. `?private=1` includes private brags (the owner's
 * choice, default off). `?format=md` is the only format for now (PDF/JSON later).
 * The response is an attachment download, never cached.
 */
export async function GET(request: Request, ctx: { params: Promise<{ documentId: string }> }) {
  const access = await getWorkspaceOrNull();
  if (!access) return new NextResponse("Unauthorized", { status: 401 });

  const { documentId } = await ctx.params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "md";
  if (format !== "md") return new NextResponse("Unsupported format", { status: 400 });
  const includePrivate = url.searchParams.get("private") === "1";

  const doc = await getDocumentForExport(
    documentId,
    { workspaceId: access.workspaceId, userId: access.user.id },
    includePrivate,
  );
  if (!doc) return new NextResponse("Not found", { status: 404 });

  const name = filenameFor(doc.title, "md");
  return new NextResponse(documentToMarkdown(doc), {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}

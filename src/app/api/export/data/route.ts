import { NextResponse } from "next/server";

import { toDataExport } from "@/features/export/json";
import { getAllDataForExport } from "@/features/export/queries";
import { getWorkspaceOrNull } from "@/lib/auth/guards";

/**
 * Full-data JSON export — the caller's entire dataset in the active workspace
 * (every document, archived included; every brag, private included), for
 * portability. Owner-only via the non-redirecting guard (401), scoped by
 * workspace + user. The static `data` segment takes precedence over the sibling
 * `[documentId]` route. Attachment download, never cached.
 */
export async function GET() {
  const access = await getWorkspaceOrNull();
  if (!access) return new NextResponse("Unauthorized", { status: 401 });

  const loaded = await getAllDataForExport({
    workspaceId: access.workspaceId,
    userId: access.user.id,
    email: access.user.email,
  });
  const data = toDataExport({ ...loaded, exportedAt: new Date().toISOString() });

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="bragbit-export.json"`,
      "Cache-Control": "no-store",
    },
  });
}

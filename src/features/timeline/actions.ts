"use server";

import { listBragsPage, type BragFilters, type BragPage } from "@/features/brag/queries";

/**
 * Next (older) window of a document's timeline for the client "load more" island
 * (PERF-01). Returns data only — the island renders it with the shared
 * TimelineChunk, so an appended page matches the server-rendered first page
 * exactly. Ownership + workspace scoping are enforced inside `listBragsPage`
 * (`requireWorkspace`), and the filters only ever narrow the caller's own rows, so
 * a forged `documentId`/`cursor` can read nothing that isn't already theirs.
 */
export async function loadMoreTimeline(
  documentId: string,
  filters: BragFilters,
  cursor: string,
): Promise<BragPage> {
  return listBragsPage(documentId, filters, cursor);
}

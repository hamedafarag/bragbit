import "server-only";

import { and, asc, count, desc, eq, exists, gte, inArray, lt, lte, sql } from "drizzle-orm";

import type { AttachmentRow } from "@/features/attachment/queries";
import { requireWorkspace } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { attachment, brag, bragLink, bragTag, document, tag } from "@/lib/db/schema";

export type BragRow = typeof brag.$inferSelect;
export type BragLinkRow = typeof bragLink.$inferSelect;
export type BragWithRelations = BragRow & {
  links: BragLinkRow[];
  attachments: AttachmentRow[];
  tags: string[];
};

/** Timeline filters (from the URL); empty fields are ignored. Dates are "YYYY-MM-DD". */
export type BragFilters = {
  category?: string;
  tag?: string;
  from?: string;
  to?: string;
};

function groupByBragId<T extends { bragId: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.bragId);
    if (list) list.push(row);
    else map.set(row.bragId, [row]);
  }
  return map;
}

/** A timeline page: brags plus the cursor for loading the next (older) window. */
export type BragPage = {
  brags: BragWithRelations[];
  /** "YYYY-MM" of the oldest month in this page — pass back to load older. null when none remain. */
  nextCursor: string | null;
  hasMore: boolean;
};

/** Window size for the timeline's "load more": brags per page, rounded up to whole months. */
export const TIMELINE_PAGE_TARGET = 30;

const MONTH_CURSOR = /^\d{4}-\d{2}$/;

/**
 * Shared WHERE for the timeline queries: a document the caller owns (scoped
 * through the join on workspace + owner, so a documentId from another workspace or
 * user matches nothing) plus the optional filters. `before` (a "YYYY-MM" cursor)
 * restricts to months strictly older than it, for cursor paging.
 */
function timelineConditions(
  documentId: string,
  workspaceId: string,
  userId: string,
  filters: BragFilters,
  before?: string,
) {
  const conditions = [
    eq(brag.documentId, documentId),
    eq(document.workspaceId, workspaceId),
    eq(document.userId, userId),
  ];
  if (filters.category) conditions.push(eq(brag.category, filters.category));
  if (filters.from) conditions.push(gte(brag.date, filters.from));
  if (filters.to) conditions.push(lte(brag.date, filters.to));
  if (before && MONTH_CURSOR.test(before)) conditions.push(lt(brag.date, `${before}-01`));
  if (filters.tag) {
    // The brag carries the chosen tag (its tags are the owner's, so name alone scopes it).
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(bragTag)
          .innerJoin(tag, eq(tag.id, bragTag.tagId))
          .where(and(eq(bragTag.bragId, brag.id), eq(tag.name, filters.tag))),
      ),
    );
  }
  return conditions;
}

/** Attach links/attachments/tags to already-scoped brag rows in batched queries (no per-brag N+1). */
async function attachRelations(brags: BragRow[]): Promise<BragWithRelations[]> {
  if (brags.length === 0) return [];
  const ids = brags.map((b) => b.id);
  const [links, attachments, tagRows] = await Promise.all([
    db.select().from(bragLink).where(inArray(bragLink.bragId, ids)).orderBy(asc(bragLink.position)),
    db
      .select()
      .from(attachment)
      .where(inArray(attachment.bragId, ids))
      .orderBy(asc(attachment.createdAt)),
    db
      .select({ bragId: bragTag.bragId, name: tag.name })
      .from(bragTag)
      .innerJoin(tag, eq(tag.id, bragTag.tagId))
      .where(inArray(bragTag.bragId, ids))
      .orderBy(asc(tag.name)),
  ]);
  const linksByBrag = groupByBragId(links);
  const attachmentsByBrag = groupByBragId(attachments);
  const tagsByBrag = groupByBragId(tagRows);
  return brags.map((b) => ({
    ...b,
    links: linksByBrag.get(b.id) ?? [],
    attachments: attachmentsByBrag.get(b.id) ?? [],
    tags: (tagsByBrag.get(b.id) ?? []).map((t) => t.name),
  }));
}

/**
 * Every brag in a document the caller owns, newest first, with relations. The
 * unwindowed read — used where the full set is wanted (the cross-tenant isolation
 * suite's oracle). The owner timeline pages with `listBragsPage`.
 */
export async function listBrags(
  documentId: string,
  filters: BragFilters = {},
): Promise<BragWithRelations[]> {
  const { workspaceId, user } = await requireWorkspace();
  const conditions = timelineConditions(documentId, workspaceId, user.id, filters);
  const rows = await db
    .select()
    .from(brag)
    .innerJoin(document, eq(document.id, brag.documentId))
    .where(and(...conditions))
    .orderBy(desc(brag.date), desc(brag.createdAt));
  return attachRelations(rows.map((r) => r.brags));
}

/**
 * One cursor-paged window of a document's timeline (PERF-01): whole months
 * newest-first until ~TIMELINE_PAGE_TARGET brags, always stopping on a month
 * boundary so a "load more" never splits a month header. `cursor` ("YYYY-MM",
 * the previous page's `nextCursor`) loads the next older window; the first page
 * passes none. `nextCursor` is the oldest month in this page (what to load older
 * than); it doubles as the next chunk's leading-gap reference. Same scoping +
 * filters as `listBrags`, so a forged documentId/cursor only ever reads the
 * caller's own brags. Concatenating the pages equals `listBrags` exactly.
 */
export async function listBragsPage(
  documentId: string,
  filters: BragFilters = {},
  cursor?: string,
): Promise<BragPage> {
  const { workspaceId, user } = await requireWorkspace();
  const conditions = timelineConditions(documentId, workspaceId, user.id, filters, cursor);

  // Month buckets (newest first) with their counts, so a page stops on a month edge.
  const monthExpr = sql<string>`to_char(${brag.date}, 'YYYY-MM')`;
  const monthRows = await db
    .select({ month: monthExpr, n: count() })
    .from(brag)
    .innerJoin(document, eq(document.id, brag.documentId))
    .where(and(...conditions))
    .groupBy(monthExpr)
    .orderBy(desc(monthExpr));
  if (monthRows.length === 0) return { brags: [], nextCursor: null, hasMore: false };

  // Take whole months until the target is reached (a single heavy month is never split).
  let taken = 0;
  let monthsTaken = 0;
  let oldestMonth = monthRows[0]!.month;
  for (const row of monthRows) {
    oldestMonth = row.month;
    taken += Number(row.n);
    monthsTaken += 1;
    if (taken >= TIMELINE_PAGE_TARGET) break;
  }
  const hasMore = monthsTaken < monthRows.length;

  const rows = await db
    .select()
    .from(brag)
    .innerJoin(document, eq(document.id, brag.documentId))
    .where(and(...conditions, gte(brag.date, `${oldestMonth}-01`)))
    .orderBy(desc(brag.date), desc(brag.createdAt));

  return {
    brags: await attachRelations(rows.map((r) => r.brags)),
    nextCursor: hasMore ? oldestMonth : null,
    hasMore,
  };
}

/** Total brags in a document the caller owns (the unfiltered header stat). */
export async function countDocumentBrags(documentId: string): Promise<number> {
  const { workspaceId, user } = await requireWorkspace();
  const [row] = await db
    .select({ n: count() })
    .from(brag)
    .innerJoin(document, eq(document.id, brag.documentId))
    .where(
      and(
        eq(brag.documentId, documentId),
        eq(document.workspaceId, workspaceId),
        eq(document.userId, user.id),
      ),
    );
  return row?.n ?? 0;
}

/** Distinct tag names used by brags in a document the caller owns (for the filter UI). */
export async function listDocumentTags(documentId: string): Promise<string[]> {
  const { workspaceId, user } = await requireWorkspace();
  const rows = await db
    .selectDistinct({ name: tag.name })
    .from(tag)
    .innerJoin(bragTag, eq(bragTag.tagId, tag.id))
    .innerJoin(brag, eq(brag.id, bragTag.bragId))
    .innerJoin(document, eq(document.id, brag.documentId))
    .where(
      and(
        eq(brag.documentId, documentId),
        eq(document.workspaceId, workspaceId),
        eq(document.userId, user.id),
      ),
    )
    .orderBy(asc(tag.name));
  return rows.map((r) => r.name);
}

export type SearchResult = {
  id: string;
  title: string;
  date: string;
  category: string | null;
  status: string | null;
  descriptionMd: string | null;
  impactMd: string | null;
  documentId: string;
  documentTitle: string;
};

/**
 * Full-text search across the caller's brags in the active workspace, ranked by
 * relevance. Scoped through the parent document (workspace + owner) so it never
 * crosses tenants or users; matches the generated `search` tsvector via the GIN
 * index. `websearch_to_tsquery` gives forgiving query syntax (quotes, OR, -).
 */
export async function searchBrags(term: string): Promise<SearchResult[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];
  const { workspaceId, user } = await requireWorkspace();
  const query = sql`websearch_to_tsquery('english', ${trimmed})`;

  return db
    .select({
      id: brag.id,
      title: brag.title,
      date: brag.date,
      category: brag.category,
      status: brag.status,
      descriptionMd: brag.descriptionMd,
      impactMd: brag.impactMd,
      documentId: brag.documentId,
      documentTitle: document.title,
    })
    .from(brag)
    .innerJoin(document, eq(document.id, brag.documentId))
    .where(
      and(
        eq(document.workspaceId, workspaceId),
        eq(document.userId, user.id),
        sql`${brag.search} @@ ${query}`,
      ),
    )
    .orderBy(desc(sql`ts_rank(${brag.search}, ${query})`))
    .limit(50);
}

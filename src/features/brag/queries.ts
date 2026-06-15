import "server-only";

import { and, asc, count, desc, eq, exists, gte, inArray, lte, sql } from "drizzle-orm";

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

/**
 * Brags in a document the caller owns, newest first, each with its links and
 * attachments. Scoped through the parent document (which carries the workspace +
 * owner) via the join, so a documentId from another workspace or user returns
 * nothing. Links and attachments load in batched queries keyed by the
 * already-scoped brag ids (no per-brag N+1).
 */
export async function listBrags(
  documentId: string,
  filters: BragFilters = {},
): Promise<BragWithRelations[]> {
  const { workspaceId, user } = await requireWorkspace();

  const conditions = [
    eq(brag.documentId, documentId),
    eq(document.workspaceId, workspaceId),
    eq(document.userId, user.id),
  ];
  if (filters.category) conditions.push(eq(brag.category, filters.category));
  if (filters.from) conditions.push(gte(brag.date, filters.from));
  if (filters.to) conditions.push(lte(brag.date, filters.to));
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

  const rows = await db
    .select()
    .from(brag)
    .innerJoin(document, eq(document.id, brag.documentId))
    .where(and(...conditions))
    .orderBy(desc(brag.date), desc(brag.createdAt));
  const brags = rows.map((r) => r.brags);
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

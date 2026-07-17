import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { BRAG_CATEGORY_VALUES } from "@/features/brag/schema";
import { db } from "@/lib/db";
import { brag, bragLink, document, member, organization } from "@/lib/db/schema";
import { env } from "@/lib/env";

// Explicit-scope data layer for the MCP tools. Unlike features/document and
// features/brag — which resolve the caller from the session via requireWorkspace()
// — these take an explicit `userId` (resolved from the OAuth token by the MCP
// handler) and derive the workspace from the target document. Tenant isolation is
// identical to the UI: every row is filtered by `userId` AND current membership of
// the document's workspace, so a token can never reach another user's or tenant's
// data. Documents are globally-unique by id, so id + userId pins one owned row.

export type McpDocument = {
  id: string;
  title: string;
  workspaceName: string;
  periodStart: string | null;
  periodEnd: string | null;
};

/** Membership join: the caller must currently belong to the document's workspace. */
const memberOfDocWorkspace = (userId: string) =>
  and(eq(member.organizationId, document.workspaceId), eq(member.userId, userId));

/** A user's non-archived documents across every workspace they belong to, newest first. */
export async function listDocumentsForUser(userId: string): Promise<McpDocument[]> {
  return db
    .select({
      id: document.id,
      title: document.title,
      workspaceName: organization.name,
      periodStart: document.periodStart,
      periodEnd: document.periodEnd,
    })
    .from(document)
    .innerJoin(organization, eq(organization.id, document.workspaceId))
    .innerJoin(member, memberOfDocWorkspace(userId))
    .where(and(eq(document.userId, userId), isNull(document.archivedAt)))
    .orderBy(desc(document.updatedAt));
}

type OwnedDoc = { id: string; workspaceId: string; title: string };

/** Verify `userId` owns `documentId` (and still belongs to its workspace); id + workspace, or null. */
async function resolveOwnedDocument(userId: string, documentId: string): Promise<OwnedDoc | null> {
  const [row] = await db
    .select({ id: document.id, workspaceId: document.workspaceId, title: document.title })
    .from(document)
    .innerJoin(member, memberOfDocWorkspace(userId))
    .where(
      and(eq(document.id, documentId), eq(document.userId, userId), isNull(document.archivedAt)),
    )
    .limit(1);
  return row ?? null;
}

/** The user's most-recently-updated non-archived document, or null. */
async function mostRecentDocument(userId: string): Promise<OwnedDoc | null> {
  const [row] = await db
    .select({ id: document.id, workspaceId: document.workspaceId, title: document.title })
    .from(document)
    .innerJoin(member, memberOfDocWorkspace(userId))
    .where(and(eq(document.userId, userId), isNull(document.archivedAt)))
    .orderBy(desc(document.updatedAt))
    .limit(1);
  return row ?? null;
}

export type AddBragInput = {
  title: string;
  documentId?: string;
  date?: string;
  category?: (typeof BRAG_CATEGORY_VALUES)[number];
  impact?: string;
  description?: string;
  links?: { url: string; label?: string }[];
};

export type AddBragResult =
  | { ok: true; id: string; documentId: string; documentTitle: string; url: string }
  | { ok: false; error: string };

/**
 * Record a brag for `userId`. The target is the given document (which must be
 * owned by the user) or, if none is given, their most-recent document. The
 * workspace is derived from that document, so the write inherits the same tenant
 * scoping as the UI. Mirrors features/brag createBrag, minus the editor-only
 * fields (tags/collaborators/visibility) the connector doesn't expose.
 */
export async function addBragForUser(userId: string, input: AddBragInput): Promise<AddBragResult> {
  const target = input.documentId
    ? await resolveOwnedDocument(userId, input.documentId)
    : await mostRecentDocument(userId);

  if (!target) {
    return {
      ok: false,
      error: input.documentId
        ? "That document doesn't exist or isn't yours. Call bragbit_list_documents to see your documents."
        : "You don't have any documents yet. Create one in BragBit first, then try again.",
    };
  }

  const links = (input.links ?? [])
    .map((l, i) => ({ url: l.url.trim(), label: l.label?.trim() || null, position: i }))
    .filter((l) => l.url !== "");

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(brag)
      .values({
        documentId: target.id,
        title: input.title.trim(),
        // `date` omitted → the column's CURRENT_DATE default (today).
        ...(input.date ? { date: input.date } : {}),
        category: input.category ?? null,
        impactMd: input.impact?.trim() || null,
        descriptionMd: input.description?.trim() || null,
      })
      .returning({ id: brag.id });
    if (links.length > 0) {
      await tx.insert(bragLink).values(links.map((l) => ({ bragId: row!.id, ...l })));
    }
    return row!;
  });

  const base = env.BETTER_AUTH_URL ?? env.APP_URL;
  return {
    ok: true,
    id: created.id,
    documentId: target.id,
    documentTitle: target.title,
    url: `${base}/documents/${target.id}`,
  };
}

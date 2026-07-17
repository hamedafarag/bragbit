"use server";

import { and, desc, eq, isNull } from "drizzle-orm";

import { createBrag } from "@/features/brag/actions";
import type { BragInput } from "@/features/brag/schema";
import { requireWorkspace } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { document, importCandidate, integrationConnection } from "@/lib/db/schema";

import { decryptToken } from "./crypto";
import { candidateToBragInput } from "./mapping";
import { getProvider } from "./providers";
import type { DecryptedConnection } from "./providers/types";
import {
  patConnectSchema,
  providerSchema,
  type PatConnectInput,
  type Provider,
  type SourceType,
} from "./schema";
import { upsertConnection } from "./service";

// Server actions for the integrations feature (docs/specs/integrations.md). Every
// action re-derives the caller through requireWorkspace (the Next.js data-security
// rule: authorize inside every server function) and scopes all reads/writes to
// (userId, workspaceId), so isolation matches the rest of the app. Approving reuses
// the features/brag create path unchanged — no new brag-write logic here.

export type ActionResult = { ok: true } | { ok: false; error: string };
export type ImportResult = { ok: true; imported: number } | { ok: false; error: string };
export type ApproveResult =
  | { ok: true; bragId: string; documentId: string }
  | { ok: false; error: string };

/** A merged PR / resolved issue is shipped work; v1 suggests this for every source. */
const DEFAULT_CATEGORY = "shipped-work";

/** Load a connection and decrypt its tokens for adapter use, or null if absent. */
async function loadConnection(
  userId: string,
  workspaceId: string,
  provider: Provider,
): Promise<{ id: string; lastSyncedAt: Date | null; decrypted: DecryptedConnection } | null> {
  const [row] = await db
    .select()
    .from(integrationConnection)
    .where(
      and(
        eq(integrationConnection.userId, userId),
        eq(integrationConnection.workspaceId, workspaceId),
        eq(integrationConnection.provider, provider),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    lastSyncedAt: row.lastSyncedAt,
    decrypted: {
      id: row.id,
      provider: row.provider as Provider,
      externalAccountLabel: row.externalAccountLabel,
      accessToken: decryptToken(row.accessToken),
      refreshToken: row.refreshToken ? decryptToken(row.refreshToken) : null,
      accessTokenExpiresAt: row.accessTokenExpiresAt,
      config: row.config ? (JSON.parse(row.config) as Record<string, unknown>) : null,
    },
  };
}

/** The caller's most-recently-updated non-archived document id, or null. */
async function mostRecentDocumentId(userId: string, workspaceId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: document.id })
    .from(document)
    .where(
      and(
        eq(document.userId, userId),
        eq(document.workspaceId, workspaceId),
        isNull(document.archivedAt),
      ),
    )
    .orderBy(desc(document.updatedAt))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Connect a provider by validating a pasted personal-access-token and storing it
 * encrypted. Upserts the single (user, workspace, provider) connection, so
 * reconnecting replaces the token in place.
 */
export async function connectPat(input: PatConnectInput): Promise<ActionResult> {
  const { user, workspaceId } = await requireWorkspace();
  const parsed = patConnectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const provider = getProvider(parsed.data.provider);
  if (!provider.supportsPat) {
    return { ok: false, error: "That provider can't be connected with a token." };
  }

  let identity;
  try {
    identity = await provider.validatePat(parsed.data.token);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not verify the token." };
  }

  await upsertConnection(user.id, workspaceId, parsed.data.provider, "pat", identity);
  return { ok: true };
}

/**
 * Fetch new source items into the review queue. Deduped on (user, provider,
 * external_id): items already seen — approved, dismissed, or still pending — are
 * skipped, so re-running only adds genuinely new candidates. Returns how many were
 * added. Never publishes; the user reviews each.
 */
export async function importNow(providerId: Provider): Promise<ImportResult> {
  const { user, workspaceId } = await requireWorkspace();
  const parsed = providerSchema.safeParse(providerId);
  if (!parsed.success) return { ok: false, error: "Unknown provider." };

  const conn = await loadConnection(user.id, workspaceId, parsed.data);
  if (!conn) return { ok: false, error: "Connect the provider first." };

  let candidates;
  try {
    candidates = await getProvider(parsed.data).fetchCandidates(
      conn.decrypted,
      conn.lastSyncedAt ?? undefined,
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Import failed." };
  }

  let imported = 0;
  if (candidates.length > 0) {
    const inserted = await db
      .insert(importCandidate)
      .values(
        candidates.map((c) => ({
          connectionId: conn.id,
          userId: user.id,
          workspaceId,
          provider: parsed.data,
          externalId: c.externalId,
          externalUrl: c.externalUrl,
          sourceType: c.sourceType,
          title: c.title,
          suggestedCategory: DEFAULT_CATEGORY,
          occurredAt: c.occurredAt,
          payload: JSON.stringify(c.payload),
        })),
      )
      .onConflictDoNothing({
        target: [importCandidate.userId, importCandidate.provider, importCandidate.externalId],
      })
      .returning({ id: importCandidate.id });
    imported = inserted.length;
  }

  await db
    .update(integrationConnection)
    .set({ lastSyncedAt: new Date() })
    .where(eq(integrationConnection.id, conn.id));

  return { ok: true, imported };
}

/**
 * Approve a pending candidate into a real brag. Maps it to brag input (the user's
 * `edits` win over the source defaults), creates the brag through features/brag —
 * which attaches the source deep link and enforces document ownership — then marks
 * the candidate approved. Target document: the given one, else the most recent.
 */
export async function approveCandidate(
  candidateId: string,
  documentId: string | null,
  edits?: Partial<BragInput>,
): Promise<ApproveResult> {
  const { user, workspaceId } = await requireWorkspace();

  const [c] = await db
    .select()
    .from(importCandidate)
    .where(
      and(
        eq(importCandidate.id, candidateId),
        eq(importCandidate.userId, user.id),
        eq(importCandidate.workspaceId, workspaceId),
        eq(importCandidate.status, "pending"),
      ),
    )
    .limit(1);
  if (!c) return { ok: false, error: "Candidate not found." };

  const targetId = documentId ?? (await mostRecentDocumentId(user.id, workspaceId));
  if (!targetId) return { ok: false, error: "Create a document first, then approve." };

  const base = candidateToBragInput({
    provider: c.provider as Provider,
    title: c.title,
    occurredAt: c.occurredAt,
    suggestedCategory: c.suggestedCategory,
    externalUrl: c.externalUrl,
    sourceType: c.sourceType as SourceType,
    payload: c.payload
      ? (JSON.parse(c.payload) as { number?: number; repo?: string; body?: string })
      : null,
  });
  const input = { ...base, ...edits };

  const created = await createBrag(targetId, input);
  if (!created.ok) return created;

  await db
    .update(importCandidate)
    .set({ status: "approved", bragId: created.id })
    .where(
      and(
        eq(importCandidate.id, candidateId),
        eq(importCandidate.userId, user.id),
        eq(importCandidate.workspaceId, workspaceId),
      ),
    );

  return { ok: true, bragId: created.id, documentId: targetId };
}

/** Dismiss a pending candidate so it leaves the queue and isn't re-suggested. */
export async function dismissCandidate(candidateId: string): Promise<ActionResult> {
  const { user, workspaceId } = await requireWorkspace();
  const updated = await db
    .update(importCandidate)
    .set({ status: "dismissed" })
    .where(
      and(
        eq(importCandidate.id, candidateId),
        eq(importCandidate.userId, user.id),
        eq(importCandidate.workspaceId, workspaceId),
        eq(importCandidate.status, "pending"),
      ),
    )
    .returning({ id: importCandidate.id });
  if (updated.length === 0) return { ok: false, error: "Candidate not found." };
  return { ok: true };
}

/**
 * Disconnect a provider: delete the connection (its candidates cascade). The stored
 * token is discarded; a PAT is user-managed at the provider, so nothing to revoke.
 */
export async function disconnectProvider(providerId: Provider): Promise<ActionResult> {
  const { user, workspaceId } = await requireWorkspace();
  const parsed = providerSchema.safeParse(providerId);
  if (!parsed.success) return { ok: false, error: "Unknown provider." };

  await db
    .delete(integrationConnection)
    .where(
      and(
        eq(integrationConnection.userId, user.id),
        eq(integrationConnection.workspaceId, workspaceId),
        eq(integrationConnection.provider, parsed.data),
      ),
    );
  return { ok: true };
}

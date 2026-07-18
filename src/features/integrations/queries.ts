import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { importCandidate, integrationConnection } from "@/lib/db/schema";

import type { AuthType, CandidateStatus, Provider, SourceType } from "./schema";

// Read layer for the integrations feature. Like features/mcp/service, these take an
// explicit (userId, workspaceId) resolved from the session by the caller and scope
// every row to it, so a query can never cross tenants. Token ciphertext is never
// selected here — decryption lives behind the import path (slice 1b), not the UI.

/** A connection as the settings UI sees it — status + identity, never the tokens. */
export type ConnectionSummary = {
  id: string;
  provider: Provider;
  authType: AuthType;
  externalAccountLabel: string | null;
  scopes: string | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
};

/** The caller's connections in a workspace, newest first (no token columns). */
export async function listConnections(
  userId: string,
  workspaceId: string,
): Promise<ConnectionSummary[]> {
  const rows = await db
    .select({
      id: integrationConnection.id,
      provider: integrationConnection.provider,
      authType: integrationConnection.authType,
      externalAccountLabel: integrationConnection.externalAccountLabel,
      scopes: integrationConnection.scopes,
      lastSyncedAt: integrationConnection.lastSyncedAt,
      createdAt: integrationConnection.createdAt,
    })
    .from(integrationConnection)
    .where(
      and(
        eq(integrationConnection.userId, userId),
        eq(integrationConnection.workspaceId, workspaceId),
      ),
    )
    .orderBy(desc(integrationConnection.createdAt));

  return rows as ConnectionSummary[];
}

/** The caller's connection for one provider in a workspace, or null. */
export async function getConnection(
  userId: string,
  workspaceId: string,
  provider: Provider,
): Promise<ConnectionSummary | null> {
  const rows = await listConnections(userId, workspaceId);
  return rows.find((c) => c.provider === provider) ?? null;
}

/** A candidate as the review queue sees it (no tokens exist on candidates). */
export type CandidateSummary = {
  id: string;
  provider: Provider;
  sourceType: SourceType;
  title: string;
  externalUrl: string;
  suggestedCategory: string | null;
  occurredAt: Date | null;
  status: CandidateStatus;
  createdAt: Date;
};

/**
 * The caller's import candidates in a workspace with the given status (default
 * pending — the review queue), most recent work first. Scoped to (userId,
 * workspaceId) so it can never surface another user's or tenant's items.
 */
export async function listCandidates(
  userId: string,
  workspaceId: string,
  status: CandidateStatus = "pending",
): Promise<CandidateSummary[]> {
  const rows = await db
    .select({
      id: importCandidate.id,
      provider: importCandidate.provider,
      sourceType: importCandidate.sourceType,
      title: importCandidate.title,
      externalUrl: importCandidate.externalUrl,
      suggestedCategory: importCandidate.suggestedCategory,
      occurredAt: importCandidate.occurredAt,
      status: importCandidate.status,
      createdAt: importCandidate.createdAt,
    })
    .from(importCandidate)
    .where(
      and(
        eq(importCandidate.userId, userId),
        eq(importCandidate.workspaceId, workspaceId),
        eq(importCandidate.status, status),
      ),
    )
    .orderBy(desc(importCandidate.occurredAt));

  return rows as CandidateSummary[];
}

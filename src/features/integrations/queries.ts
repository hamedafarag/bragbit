import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { integrationConnection } from "@/lib/db/schema";

import type { AuthType, Provider } from "./schema";

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

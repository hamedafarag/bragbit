import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { oauthAccessToken, oauthApplication } from "@/lib/db/schema";

// Reads over the OAuth 2.1 provider tables (Better Auth mcp plugin). Two callers:
// the consent screen (client display name) and Settings → Connected apps (list +
// revoke). Clients are global rows (not workspace-scoped), so these queries filter
// by the acting user where the data is per-user (tokens).

/** Display info for a registered OAuth client, by its public `client_id`. */
export async function getOAuthClientByClientId(clientId: string) {
  const [client] = await db
    .select({ name: oauthApplication.name, icon: oauthApplication.icon })
    .from(oauthApplication)
    .where(eq(oauthApplication.clientId, clientId))
    .limit(1);
  return client ?? null;
}

/**
 * The apps a user has authorized — one row per client that holds a live token for
 * them (most recent token's scopes + issue time). Keyed off `oauth_access_token`,
 * not `oauth_consent`: a consent row is only written on the `prompt=consent` path,
 * whereas a token is issued on every grant, so tokens are the source of truth for
 * "has access". Powers Settings → Connected apps.
 */
export async function listConnectedApps(userId: string) {
  const rows = await db
    .selectDistinctOn([oauthAccessToken.clientId], {
      clientId: oauthAccessToken.clientId,
      name: oauthApplication.name,
      icon: oauthApplication.icon,
      scopes: oauthAccessToken.scopes,
      authorizedAt: oauthAccessToken.createdAt,
    })
    .from(oauthAccessToken)
    .innerJoin(oauthApplication, eq(oauthApplication.clientId, oauthAccessToken.clientId))
    .where(eq(oauthAccessToken.userId, userId))
    // distinctOn needs the leading order key to match; desc(createdAt) picks the newest token.
    .orderBy(oauthAccessToken.clientId, desc(oauthAccessToken.createdAt));
  // Present newest-authorized first (distinctOn forced clientId ordering above).
  return rows.sort((a, b) => b.authorizedAt.getTime() - a.authorizedAt.getTime());
}

export type ConnectedApp = Awaited<ReturnType<typeof listConnectedApps>>[number];

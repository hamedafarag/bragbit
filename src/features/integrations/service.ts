import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { integrationConnection } from "@/lib/db/schema";

import { encryptToken } from "./crypto";
import type { ConnectionTokens, RefreshedTokens } from "./providers/types";
import type { AuthType, Provider } from "./schema";

// Shared connection persistence for the integrations feature. Deliberately NOT a
// "use server" module: the OAuth callback route handler and the connectPat action
// both call upsertConnection, and it must not become a client-invocable action
// (that would let anyone POST arbitrary tokens). Tokens are encrypted here.

/** Short-lived httpOnly cookie holding the OAuth CSRF `state` between authorize and callback. */
export function oauthStateCookie(provider: Provider): string {
  return `bragbit_oauth_state_${provider}`;
}

/**
 * Create or replace the caller's connection for a provider in a workspace, storing
 * the tokens encrypted. One row per (user, workspace, provider); reconnecting (PAT
 * re-paste or a fresh OAuth grant) overwrites the tokens and identity in place.
 */
export async function upsertConnection(
  userId: string,
  workspaceId: string,
  provider: Provider,
  authType: AuthType,
  tokens: ConnectionTokens,
): Promise<void> {
  const fields = {
    authType,
    externalAccountId: tokens.externalAccountId,
    externalAccountLabel: tokens.externalAccountLabel,
    accessToken: encryptToken(tokens.accessToken),
    refreshToken: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt ?? null,
    scopes: tokens.scopes ?? null,
    config: tokens.config ? JSON.stringify(tokens.config) : null,
  };

  await db
    .insert(integrationConnection)
    .values({ userId, workspaceId, provider, ...fields })
    .onConflictDoUpdate({
      target: [
        integrationConnection.userId,
        integrationConnection.workspaceId,
        integrationConnection.provider,
      ],
      set: { ...fields, updatedAt: new Date() },
    });
}

/**
 * Persist rotated tokens after an OAuth refresh, by connection id. Updates only the
 * token columns (identity is unchanged), re-encrypting at rest. Linear rotates the
 * access token every ~24h; a fresh refresh token is stored when the provider returns
 * one, otherwise the existing one is kept.
 */
export async function refreshConnectionToken(
  connectionId: string,
  refreshed: RefreshedTokens,
): Promise<void> {
  await db
    .update(integrationConnection)
    .set({
      accessToken: encryptToken(refreshed.accessToken),
      ...(refreshed.refreshToken ? { refreshToken: encryptToken(refreshed.refreshToken) } : {}),
      accessTokenExpiresAt: refreshed.accessTokenExpiresAt ?? null,
      ...(refreshed.scopes ? { scopes: refreshed.scopes } : {}),
      updatedAt: new Date(),
    })
    .where(eq(integrationConnection.id, connectionId));
}

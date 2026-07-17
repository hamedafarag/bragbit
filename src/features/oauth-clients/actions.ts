"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { oauthAccessToken, oauthConsent } from "@/lib/db/schema";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Revoke an AI client's access for the current user: delete its live access/refresh
 * tokens and any standing consent. Scoped to the caller's own user id in the WHERE,
 * so a user can only ever revoke their own grants. Keyed off tokens (not consent) —
 * the auto-approve grant path issues a token without a consent row — so this reaches
 * apps the "Connected apps" list surfaces. The client can reconnect later, but its
 * current tokens stop working immediately: the next tools/call gets 401.
 */
export async function revokeConnectedApp(clientId: string): Promise<ActionResult> {
  const { user } = await requireSession();
  if (!clientId) return { ok: false, error: "Missing app." };

  const tokens = await db
    .delete(oauthAccessToken)
    .where(and(eq(oauthAccessToken.userId, user.id), eq(oauthAccessToken.clientId, clientId)))
    .returning({ id: oauthAccessToken.id });
  const consents = await db
    .delete(oauthConsent)
    .where(and(eq(oauthConsent.userId, user.id), eq(oauthConsent.clientId, clientId)))
    .returning({ id: oauthConsent.id });

  if (tokens.length === 0 && consents.length === 0) {
    return { ok: false, error: "That app isn't connected." };
  }
  revalidatePath("/settings");
  return { ok: true };
}

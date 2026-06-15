import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Stateless one-click unsubscribe token. The email carries the user id plus an
 * HMAC over it (keyed by the app secret), so the unsubscribe link needs no
 * server-side token storage and can't be forged. Mirrors the share-unlock proof.
 */
function token(userId: string): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`reminder:${userId}`)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** The unsubscribe token for a user (embedded in the reminder email link). */
export function unsubscribeToken(userId: string): string {
  return token(userId);
}

/** Whether `candidate` is the valid unsubscribe token for `userId`. */
export function verifyUnsubscribeToken(userId: string, candidate: string): boolean {
  return safeEqual(candidate, token(userId));
}

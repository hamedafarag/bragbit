import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { env } from "@/lib/env";

/**
 * Per-share unlock proof + cookie (Phase 6.4). After a visitor enters the correct
 * password we set an httpOnly cookie whose value is an HMAC over the share id AND
 * its current password hash. Binding the hash means changing or removing the
 * password invalidates every outstanding unlock cookie — no server-side session
 * store needed. The app secret is the HMAC key, so a cookie can't be forged.
 */
const COOKIE_PREFIX = "bb_share_";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function cookieName(shareId: string): string {
  return `${COOKIE_PREFIX}${shareId}`;
}

function proof(shareId: string, passwordHash: string): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`${shareId}:${passwordHash}`)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Whether the request carries a valid unlock cookie for this share's current password. */
export async function isShareUnlocked(shareId: string, passwordHash: string): Promise<boolean> {
  const jar = await cookies();
  const got = jar.get(cookieName(shareId))?.value;
  return got != null && safeEqual(got, proof(shareId, passwordHash));
}

/** Mark this share unlocked for the visitor (httpOnly, scoped to the whole site). */
export async function setShareUnlockCookie(shareId: string, passwordHash: string): Promise<void> {
  const jar = await cookies();
  jar.set(cookieName(shareId), proof(shareId, passwordHash), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

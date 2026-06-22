import "server-only";

import { and, asc, eq, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { rateLimitHit } from "@/lib/db/schema";

import type { RateLimitResult } from "./rate-limit";

/**
 * Postgres-backed sliding-window limiter for the hosted instance (ENH-SEC-02 —
 * loaded lazily, only when `INSTANCE_MODE=hosted`). A per-key transactional advisory
 * lock serializes concurrent checks for the same key across every app instance, so
 * the sweep → count → insert is atomic; expired rows are removed on each check.
 */
export async function hitRateLimitPg(
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): Promise<RateLimitResult> {
  return db.transaction(async (tx) => {
    // Serialize same-key checks across instances; auto-released at transaction end.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
    await tx
      .delete(rateLimitHit)
      .where(and(eq(rateLimitHit.key, key), lt(rateLimitHit.at, new Date(now - windowMs))));
    const rows = await tx
      .select({ at: rateLimitHit.at })
      .from(rateLimitHit)
      .where(eq(rateLimitHit.key, key))
      .orderBy(asc(rateLimitHit.at));
    if (rows.length >= limit) {
      const retryMs = windowMs - (now - rows[0]!.at.getTime());
      return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(retryMs / 1000)) };
    }
    await tx.insert(rateLimitHit).values({ key, at: new Date(now) });
    return { ok: true };
  });
}

/** Forget a key's attempts in the shared store (e.g. after a successful unlock). */
export async function resetRateLimitPg(key: string): Promise<void> {
  await db.delete(rateLimitHit).where(eq(rateLimitHit.key, key));
}

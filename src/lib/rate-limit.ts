/**
 * A sliding-window rate limiter keyed by an arbitrary string (e.g.
 * `share-unlock:<id>`). Single-process in-memory by default — fine for the private
 * single-container self-host. On the HOSTED instance (`INSTANCE_MODE=hosted`) it
 * uses a shared Postgres store (`lib/rate-limit-pg`) so a limit holds across multiple
 * app instances (ENH-SEC-02); the private modes never load it.
 *
 * `now` is injectable so the in-memory path is deterministically unit-testable.
 */
const attempts = new Map<string, number[]>();

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

// Read INSTANCE_MODE raw (not via @/lib/env) so the limiter — and its DB-free
// in-memory unit test — stay importable without the full validated env or a database.
function sharedStoreEnabled(): boolean {
  return process.env.INSTANCE_MODE === "hosted";
}

/**
 * Record an attempt for `key`, and deny once `limit` attempts fall within the
 * trailing `windowMs`. Every call counts as an attempt (so it bounds brute force
 * regardless of success); call `resetRateLimit` after a legitimate success.
 */
export async function hitRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  if (sharedStoreEnabled()) {
    const { hitRateLimitPg } = await import("./rate-limit-pg");
    return hitRateLimitPg(key, limit, windowMs, now);
  }

  const recent = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    attempts.set(key, recent);
    const retryAfterMs = windowMs - (now - recent[0]!);
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }
  recent.push(now);
  attempts.set(key, recent);
  return { ok: true };
}

/** Forget a key's attempts (e.g. after a successful unlock). */
export async function resetRateLimit(key: string): Promise<void> {
  if (sharedStoreEnabled()) {
    const { resetRateLimitPg } = await import("./rate-limit-pg");
    await resetRateLimitPg(key);
    return;
  }
  attempts.delete(key);
}

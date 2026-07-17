/**
 * A tiny in-memory sliding-window rate limiter. Single-process — fine for the
 * self-host (one container); a shared store (Redis) would be the multi-instance
 * upgrade. Keyed by an arbitrary string (e.g. `share-unlock:<id>`).
 *
 * `now` is injectable so the limiter is deterministically unit-testable.
 */
const attempts = new Map<string, number[]>();

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Record an attempt for `key`, and deny once `limit` attempts fall within the
 * trailing `windowMs`. Every call counts as an attempt (so it bounds brute force
 * regardless of success); call `resetRateLimit` after a legitimate success.
 */
export function hitRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
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
export function resetRateLimit(key: string): void {
  attempts.delete(key);
}

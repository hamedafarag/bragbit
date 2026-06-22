import { describe, expect, it } from "vitest";

import { hitRateLimit, resetRateLimit } from "./rate-limit";

// The in-memory path (INSTANCE_MODE is not "hosted" in the test runs). The hosted
// shared-store (Postgres) path is covered by rate-limit-pg.test.ts.
describe("hitRateLimit (in-memory)", () => {
  it("allows up to the limit, then blocks within the window", async () => {
    const key = "test:allow-then-block";
    await resetRateLimit(key);
    for (let i = 0; i < 3; i++) {
      expect((await hitRateLimit(key, 3, 1000, 1000 + i)).ok).toBe(true);
    }
    const blocked = await hitRateLimit(key, 3, 1000, 1003);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("frees slots once the window slides past old attempts", async () => {
    const key = "test:slide";
    await resetRateLimit(key);
    expect((await hitRateLimit(key, 2, 1000, 0)).ok).toBe(true);
    expect((await hitRateLimit(key, 2, 1000, 500)).ok).toBe(true);
    expect((await hitRateLimit(key, 2, 1000, 600)).ok).toBe(false); // both still in window
    expect((await hitRateLimit(key, 2, 1000, 1600)).ok).toBe(true); // the t=0 attempt expired
  });

  it("reset clears prior attempts", async () => {
    const key = "test:reset";
    await resetRateLimit(key);
    expect((await hitRateLimit(key, 1, 1000, 0)).ok).toBe(true);
    expect((await hitRateLimit(key, 1, 1000, 1)).ok).toBe(false);
    await resetRateLimit(key);
    expect((await hitRateLimit(key, 1, 1000, 2)).ok).toBe(true);
  });

  it("keys are independent", async () => {
    await resetRateLimit("test:a");
    await resetRateLimit("test:b");
    expect((await hitRateLimit("test:a", 1, 1000, 0)).ok).toBe(true);
    expect((await hitRateLimit("test:a", 1, 1000, 1)).ok).toBe(false);
    expect((await hitRateLimit("test:b", 1, 1000, 1)).ok).toBe(true);
  });
});

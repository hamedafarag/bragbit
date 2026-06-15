import { describe, expect, it } from "vitest";

import { hitRateLimit, resetRateLimit } from "./rate-limit";

describe("hitRateLimit", () => {
  it("allows up to the limit, then blocks within the window", () => {
    const key = "test:allow-then-block";
    resetRateLimit(key);
    for (let i = 0; i < 3; i++) {
      expect(hitRateLimit(key, 3, 1000, 1000 + i).ok).toBe(true);
    }
    const blocked = hitRateLimit(key, 3, 1000, 1003);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("frees slots once the window slides past old attempts", () => {
    const key = "test:slide";
    resetRateLimit(key);
    expect(hitRateLimit(key, 2, 1000, 0).ok).toBe(true);
    expect(hitRateLimit(key, 2, 1000, 500).ok).toBe(true);
    expect(hitRateLimit(key, 2, 1000, 600).ok).toBe(false); // both still in window
    expect(hitRateLimit(key, 2, 1000, 1600).ok).toBe(true); // the t=0 attempt expired
  });

  it("reset clears prior attempts", () => {
    const key = "test:reset";
    resetRateLimit(key);
    expect(hitRateLimit(key, 1, 1000, 0).ok).toBe(true);
    expect(hitRateLimit(key, 1, 1000, 1).ok).toBe(false);
    resetRateLimit(key);
    expect(hitRateLimit(key, 1, 1000, 2).ok).toBe(true);
  });

  it("keys are independent", () => {
    resetRateLimit("test:a");
    resetRateLimit("test:b");
    expect(hitRateLimit("test:a", 1, 1000, 0).ok).toBe(true);
    expect(hitRateLimit("test:a", 1, 1000, 1).ok).toBe(false);
    expect(hitRateLimit("test:b", 1, 1000, 1).ok).toBe(true);
  });
});

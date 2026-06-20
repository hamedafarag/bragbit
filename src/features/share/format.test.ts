import { describe, expect, it } from "vitest";

import { formatAccessed } from "./format";

describe("formatAccessed", () => {
  it("formats an ISO timestamp as 'Mon D, h:MM AM/PM' (en-US)", () => {
    // Shape check only — toLocaleString uses the runner's local time zone, so the
    // exact value isn't asserted; the format options are what this guards.
    const out = formatAccessed("2026-06-17T15:30:00.000Z");
    expect(out).toMatch(/^[A-Z][a-z]{2}\s\d{1,2},\s\d{1,2}:\d{2}\s[AP]M$/);
  });

  it("zero-pads the minutes to two digits", () => {
    // The minute field is always two digits regardless of time zone.
    const out = formatAccessed("2026-01-02T08:09:00.000Z");
    expect(out).toMatch(/:\d{2}\s[AP]M$/);
  });
});

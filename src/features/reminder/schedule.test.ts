import { describe, expect, it } from "vitest";

import { isReminderDue, localDayHour, TARGET_HOUR } from "./schedule";

// 2026-06-12 is a Friday (day 5); 09:30 UTC.
const friMorningUtc = new Date("2026-06-12T09:30:00Z");

describe("localDayHour", () => {
  it("reports the local day and hour for a zone", () => {
    expect(localDayHour(friMorningUtc, "UTC")).toEqual({ day: 5, hour: 9 });
    expect(localDayHour(friMorningUtc, "Asia/Riyadh")).toEqual({ day: 5, hour: 12 }); // +3
    expect(localDayHour(friMorningUtc, "America/New_York")).toEqual({ day: 5, hour: 5 }); // EDT −4
  });

  it("rolls the day backward across midnight", () => {
    // 01:00 UTC Fri → 18:00 Thursday in Los Angeles (PDT −7).
    const early = new Date("2026-06-12T01:00:00Z");
    expect(localDayHour(early, "America/Los_Angeles")).toEqual({ day: 4, hour: 18 });
  });
});

describe("isReminderDue", () => {
  const base = { reminderDay: 5, timezone: "UTC", lastRemindedAt: null };

  it("is due on the right day at the target hour", () => {
    const now = new Date(`2026-06-12T0${TARGET_HOUR}:30:00Z`);
    expect(isReminderDue(now, base)).toBe(true);
  });

  it("is not due on the wrong day or hour", () => {
    expect(isReminderDue(friMorningUtc, { ...base, reminderDay: 3 })).toBe(false); // wrong day
    const tenUtc = new Date("2026-06-12T10:30:00Z");
    expect(isReminderDue(tenUtc, base)).toBe(false); // past the target hour
  });

  it("requires both a day and a timezone", () => {
    expect(isReminderDue(friMorningUtc, { ...base, reminderDay: null })).toBe(false);
    expect(isReminderDue(friMorningUtc, { ...base, timezone: null })).toBe(false);
  });

  it("dedups within the window but not after it", () => {
    const now = new Date("2026-06-12T09:30:00Z");
    const oneHourAgo = new Date("2026-06-12T08:30:00Z");
    const lastWeek = new Date("2026-06-05T09:30:00Z");
    expect(isReminderDue(now, { ...base, lastRemindedAt: oneHourAgo })).toBe(false);
    expect(isReminderDue(now, { ...base, lastRemindedAt: lastWeek })).toBe(true);
  });
});

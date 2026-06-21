import { describe, expect, it } from "vitest";

import { buildActivity, levelFor, windowStart, type ActivityCount } from "./activity";

// A fixed reference: 2026-06-17 is a Wednesday (UTC), so its week is Sun 06-14 → Sat 06-20.
const TODAY = "2026-06-17";

describe("levelFor", () => {
  it("buckets counts into 0–4", () => {
    expect(levelFor(0)).toBe(0);
    expect(levelFor(1)).toBe(1);
    expect(levelFor(2)).toBe(2);
    expect(levelFor(3)).toBe(3);
    expect(levelFor(4)).toBe(3);
    expect(levelFor(5)).toBe(4);
    expect(levelFor(99)).toBe(4);
  });
});

describe("windowStart", () => {
  it("returns the Sunday weeks-1 weeks before today's Sunday", () => {
    // today's Sunday is 06-14; one week back start (weeks=1) is that Sunday itself.
    expect(windowStart(TODAY, 1)).toBe("2026-06-14");
    // weeks=2 → the prior Sunday.
    expect(windowStart(TODAY, 2)).toBe("2026-06-07");
  });
});

describe("buildActivity grid", () => {
  it("builds weeks columns of 7 days, ending at today's week", () => {
    const a = buildActivity([], TODAY, 4);
    expect(a.weeks).toHaveLength(4);
    expect(a.weeks.every((c) => c.length === 7)).toBe(true);
    expect(a.weeks[0]![0]!.date).toBe("2026-05-24"); // first Sunday
    expect(a.weeks[3]![0]!.date).toBe("2026-06-14"); // current week's Sunday
    expect(a.weekCount).toBe(4);
  });

  it("marks days after today as out of window (blank, count 0)", () => {
    const a = buildActivity([{ date: "2026-06-18", count: 9 }], TODAY, 1);
    const thu = a.weeks[0]!.find((d) => d.date === "2026-06-18")!; // the day after today
    expect(thu.inWindow).toBe(false);
    expect(thu.count).toBe(0);
    // A future-dated win is never counted.
    expect(a.totalWins).toBe(0);
  });

  it("maps counts to the right day with levels and totals", () => {
    const counts: ActivityCount[] = [
      { date: "2026-06-15", count: 1 },
      { date: "2026-06-16", count: 5 },
    ];
    const a = buildActivity(counts, TODAY, 1);
    const mon = a.weeks[0]!.find((d) => d.date === "2026-06-15")!;
    const tue = a.weeks[0]!.find((d) => d.date === "2026-06-16")!;
    expect(mon.count).toBe(1);
    expect(mon.level).toBe(1);
    expect(tue.level).toBe(4);
    expect(a.totalWins).toBe(6);
    expect(a.activeDays).toBe(2);
  });

  it("labels the first column and each new month", () => {
    const a = buildActivity([], TODAY, 6); // spans early May → mid June 2026
    expect(a.monthLabels[0]!.weekIndex).toBe(0);
    const labels = a.monthLabels.map((m) => m.label);
    expect(labels).toContain("May");
    expect(labels).toContain("Jun");
  });
});

describe("buildActivity streaks", () => {
  // Put one win in each of the last `n` weeks (counting back from today's week).
  function winsForRecentWeeks(weekOffsets: number[]): ActivityCount[] {
    return weekOffsets.map((w) => ({ date: addWeeks(TODAY, -w), count: 1 }));
  }
  function addWeeks(today: string, w: number): string {
    const [y, m, d] = today.split("-").map(Number);
    const dt = new Date(Date.UTC(y!, m! - 1, d! + w * 7));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  }

  it("counts the current week plus consecutive prior weeks", () => {
    const a = buildActivity(winsForRecentWeeks([0, 1, 2]), TODAY, 8);
    expect(a.currentStreak).toBe(3);
  });

  it("is lenient: an empty in-progress current week keeps the prior run", () => {
    const a = buildActivity(winsForRecentWeeks([1, 2]), TODAY, 8); // nothing this week
    expect(a.currentStreak).toBe(2);
  });

  it("breaks on a real gap", () => {
    const a = buildActivity(winsForRecentWeeks([0, 1, 3]), TODAY, 8); // week 2 missing
    expect(a.currentStreak).toBe(2);
  });

  it("is 0 when neither this nor last week has a win", () => {
    const a = buildActivity(winsForRecentWeeks([2, 3]), TODAY, 8);
    expect(a.currentStreak).toBe(0);
  });

  it("reports the longest run anywhere in the window", () => {
    const a = buildActivity(winsForRecentWeeks([0, 2, 3, 4, 6]), TODAY, 10);
    expect(a.longestStreak).toBe(3); // weeks 2,3,4
  });
});

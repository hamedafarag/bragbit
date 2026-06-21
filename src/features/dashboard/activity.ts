// Pure activity model for the dashboard heatmap + streak (ENH-UX-05). No DOM, no
// DB, today injected — so it's deterministic and unit-testable. Works on plain
// "YYYY-MM-DD" calendar strings (UTC date math, no time-of-day), matching how
// brags are dated; string comparison of those is chronological.

export type ActivityCount = { date: string; count: number };

export type ActivityLevel = 0 | 1 | 2 | 3 | 4;

/** One cell of the heatmap. `inWindow` is false for days after today (the tail of
 * the current week) so they render as blank placeholders, not zero-activity. */
export type ActivityDay = { date: string; count: number; level: ActivityLevel; inWindow: boolean };

/** A month name to render above the column where that month begins. */
export type MonthLabel = { weekIndex: number; label: string };

export type ActivityData = {
  weeks: ActivityDay[][]; // columns, each 7 days Sun→Sat
  monthLabels: MonthLabel[];
  currentStreak: number; // consecutive weeks with ≥1 win, ending at/just before today
  longestStreak: number;
  totalWins: number;
  activeDays: number;
  weekCount: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
}

/** Heatmap intensity bucket for a day's win count. */
export function levelFor(count: number): ActivityLevel {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

/** The Sunday that opens the grid: `weeks - 1` weeks before the Sunday of today's
 * week. Exported so the query can fetch exactly the window the grid renders. */
export function windowStart(today: string, weeks: number): string {
  const t = parseYmd(today);
  const sunday = addDays(t, -t.getUTCDay());
  return ymd(addDays(sunday, -(weeks - 1) * 7));
}

/** Assemble the heatmap grid, month labels, streaks, and totals from per-day win
 * counts. The grid spans `weeks` Sunday-aligned columns ending at today's week. */
export function buildActivity(counts: ActivityCount[], today: string, weeks = 52): ActivityData {
  const map = new Map(counts.map((c) => [c.date, c.count]));
  const start = parseYmd(windowStart(today, weeks));

  const weekCols: ActivityDay[][] = [];
  const monthLabels: MonthLabel[] = [];
  let totalWins = 0;
  let activeDays = 0;
  let lastMonth = -1;

  for (let w = 0; w < weeks; w++) {
    const col: ActivityDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = ymd(addDays(start, w * 7 + d));
      const inWindow = date <= today;
      const count = inWindow ? (map.get(date) ?? 0) : 0;
      if (count > 0) {
        totalWins += count;
        activeDays++;
      }
      col.push({ date, count, level: levelFor(count), inWindow });
    }
    // Label a column when its first day starts a new calendar month.
    const month = parseYmd(col[0]!.date).getUTCMonth();
    if (month !== lastMonth) {
      monthLabels.push({ weekIndex: w, label: MONTHS[month]! });
      lastMonth = month;
    }
    weekCols.push(col);
  }

  // A week is "active" if any in-window day in it has a win.
  const active = weekCols.map((col) => col.some((day) => day.inWindow && day.count > 0));

  // Current streak walks back from the last column. An inactive *current* week is
  // treated as in-progress (skipped, not a break) so it doesn't zero a real run.
  let i = active.length - 1;
  let currentStreak = 0;
  if (i >= 0 && !active[i]) i--;
  while (i >= 0 && active[i]) {
    currentStreak++;
    i--;
  }

  let longestStreak = 0;
  let run = 0;
  for (const a of active) {
    if (a) {
      run++;
      if (run > longestStreak) longestStreak = run;
    } else {
      run = 0;
    }
  }

  return {
    weeks: weekCols,
    monthLabels,
    currentStreak,
    longestStreak,
    totalWins,
    activeDays,
    weekCount: weeks,
  };
}

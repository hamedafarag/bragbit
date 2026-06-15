/**
 * Reminder scheduling math — pure (no DB/IO), so the timezone and dedup logic is
 * deterministically unit-testable. `send.ts` applies it to each opted-in user.
 */

/** The local hour a reminder fires on the chosen day (a calm mid-morning nudge). */
export const TARGET_HOUR = 9;
/** Skip if reminded within this window, so a repeated tick in the hour can't double-send. */
export const DEDUP_WINDOW_MS = 20 * 60 * 60 * 1000;

const DAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** The day-of-week (0–6, Sun–Sat) and hour (0–23) of `now` in an IANA time zone. */
export function localDayHour(now: Date, timeZone: string): { day: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return { day: DAY_INDEX[weekday] ?? 0, hour };
}

export type ReminderState = {
  reminderDay: number | null;
  timezone: string | null;
  lastRemindedAt: Date | null;
};

/**
 * Whether a reminder is due for `state` at `now`: it's the user's chosen day at
 * the target local hour (in their zone) and they weren't reminded within the dedup
 * window. Missing day/timezone is never due.
 */
export function isReminderDue(now: Date, state: ReminderState): boolean {
  if (state.reminderDay == null || !state.timezone) return false;
  const { day, hour } = localDayHour(now, state.timezone);
  if (day !== state.reminderDay || hour !== TARGET_HOUR) return false;
  if (state.lastRemindedAt && now.getTime() - state.lastRemindedAt.getTime() < DEDUP_WINDOW_MS) {
    return false;
  }
  return true;
}

import { z } from "zod";

/** Day-of-week labels for `reminder_day` (0 = Sunday … 6 = Saturday, JS convention). */
export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Whether a string is a valid IANA time zone (the runtime's tz database). */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Weekly-reminder preferences (shared by the settings form and the action). Day
// and timezone are always carried (so toggling off then on keeps the choice); the
// timezone is validated against the runtime IANA database.
export const reminderSchema = z.object({
  enabled: z.boolean(),
  day: z.number().int().min(0).max(6),
  timezone: z.string().min(1).max(64).refine(isValidTimeZone, "Unknown time zone"),
});

export type ReminderInput = z.infer<typeof reminderSchema>;

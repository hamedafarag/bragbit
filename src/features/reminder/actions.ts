"use server";

import { requireSession } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { profile } from "@/lib/db/schema";

import { reminderSchema, type ReminderInput } from "./schema";

export type ReminderResult = { ok: true } | { ok: false; error: string };

/**
 * Save the caller's weekly-reminder preferences (opt-in, day-of-week, timezone)
 * onto their profile row, upserting it if they've never saved one. Self-scoped via
 * requireSession — reminders are a personal account setting, not workspace-scoped.
 */
export async function updateReminderSettings(input: ReminderInput): Promise<ReminderResult> {
  const { user } = await requireSession();

  const parsed = reminderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const fields = {
    reminderEnabled: parsed.data.enabled,
    reminderDay: parsed.data.day,
    timezone: parsed.data.timezone,
  };
  await db
    .insert(profile)
    .values({ userId: user.id, ...fields })
    .onConflictDoUpdate({ target: profile.userId, set: fields });

  return { ok: true };
}

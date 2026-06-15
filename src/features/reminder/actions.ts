"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { profile } from "@/lib/db/schema";

import { reminderSchema, type ReminderInput } from "./schema";
import { verifyUnsubscribeToken } from "./unsubscribe";

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

/**
 * Turn off a user's reminders from the one-click email link — no session, authorized
 * by the stateless HMAC token over the user id. Idempotent (a valid token always
 * disables); an invalid/forged token is rejected.
 */
export async function unsubscribeReminders(userId: string, token: string): Promise<ReminderResult> {
  if (!verifyUnsubscribeToken(userId, token)) {
    return { ok: false, error: "This unsubscribe link is invalid." };
  }
  await db.update(profile).set({ reminderEnabled: false }).where(eq(profile.userId, userId));
  return { ok: true };
}

/**
 * Form action behind the unsubscribe page's button — a bound server action so the
 * page works with no client JS. Redirects back with `?done=1` (or `?error=1`). The
 * form's FormData is passed but unused, so it isn't in the signature.
 */
export async function unsubscribeReminderForm(userId: string, token: string): Promise<void> {
  const result = await unsubscribeReminders(userId, token);
  redirect(`/unsubscribe/${userId}/${token}?${result.ok ? "done=1" : "error=1"}`);
}

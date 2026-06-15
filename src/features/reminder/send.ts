import "server-only";

import { asc, eq } from "drizzle-orm";

import { sendEmail } from "@/lib/email/send";
import { db } from "@/lib/db";
import { member, organization, profile, user } from "@/lib/db/schema";
import { emailBrandFromOrg } from "@/lib/branding";
import { env } from "@/lib/env";

import { WeeklyReminder } from "@/emails/weekly-reminder";
import { isReminderDue } from "./schedule";
import { unsubscribeToken } from "./unsubscribe";

function baseUrl(): string {
  return (env.BETTER_AUTH_URL ?? env.APP_URL).replace(/\/$/, "");
}

/**
 * Send the weekly reminder to every opted-in user for whom it's now their chosen
 * day at the target local hour (in their own time zone), skipping anyone reminded
 * within the dedup window. Each user is marked *before* sending so a transient
 * SMTP failure costs at most a missed nudge, never a duplicate. Branded to the
 * user's workspace (earliest membership). `now` is injectable for testing.
 * Returns how many were sent.
 */
export async function sendDueReminders(now: Date = new Date()): Promise<{ sent: number }> {
  const rows = await db
    .select({
      userId: profile.userId,
      email: user.email,
      reminderDay: profile.reminderDay,
      timezone: profile.timezone,
      lastRemindedAt: profile.lastRemindedAt,
      orgName: organization.name,
      accentColor: organization.accentColor,
      logoKey: organization.logoKey,
    })
    .from(profile)
    .innerJoin(user, eq(user.id, profile.userId))
    .innerJoin(member, eq(member.userId, profile.userId))
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(profile.reminderEnabled, true))
    .orderBy(asc(member.createdAt));

  // One reminder per user — keep the earliest membership's workspace for branding.
  const seen = new Set<string>();
  let sent = 0;
  for (const r of rows) {
    if (seen.has(r.userId)) continue;
    seen.add(r.userId);

    if (!isReminderDue(now, r)) continue;

    await db.update(profile).set({ lastRemindedAt: now }).where(eq(profile.userId, r.userId));

    const brand = emailBrandFromOrg({
      name: r.orgName,
      accentColor: r.accentColor,
      logoKey: r.logoKey,
    });
    try {
      await sendEmail({
        to: r.email,
        subject: "What did you ship this week?",
        template: WeeklyReminder({
          brand,
          quickAddUrl: `${baseUrl()}/dashboard`,
          unsubscribeUrl: `${baseUrl()}/unsubscribe/${r.userId}/${unsubscribeToken(r.userId)}`,
        }),
      });
      sent += 1;
    } catch {
      // Leave the user marked: a failed nudge is recoverable next week; spam isn't.
    }
  }
  return { sent };
}

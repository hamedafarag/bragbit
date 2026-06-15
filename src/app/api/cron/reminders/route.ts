import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { sendDueReminders } from "@/features/reminder/send";
import { env } from "@/lib/env";

/** Constant-time compare of the provided secret against CRON_SECRET. */
function secretOk(provided: string | null): boolean {
  if (!provided || !env.CRON_SECRET) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(env.CRON_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * External-cron fallback for the reminder scheduler: a host cron (or platform
 * scheduler) POSTs here on an interval to send any due reminders. Secured by
 * CRON_SECRET via `Authorization: Bearer <secret>`; disabled (503) when the secret
 * isn't configured. The in-process node-cron scheduler (instrumentation.ts) calls
 * the same sendDueReminders directly. Run it at least hourly — a user is only due
 * in the single local hour the reminder fires.
 */
export async function POST(request: Request) {
  if (!env.CRON_SECRET) {
    return NextResponse.json({ error: "Cron is not configured." }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  const provided = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null;
  if (!secretOk(provided)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sent } = await sendDueReminders();
  return NextResponse.json({ ok: true, sent });
}

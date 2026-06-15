/**
 * Next.js instrumentation — runs once when a server instance starts. We use it to
 * register the in-process weekly-reminder scheduler (PLAN §6/§8) so a self-host
 * needs no external cron.
 *
 * Gated to the Node.js runtime in production — i.e. the standalone Docker server.
 * In dev (and on serverless, where a long-lived in-process cron doesn't fit), use
 * the secured `POST /api/cron/reminders` route instead. Running both is safe: the
 * `last_reminded_at` dedup means a user can't be reminded twice in a day.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;

  const { schedule } = await import("node-cron");
  const { sendDueReminders } = await import("@/features/reminder/send");

  // On the hour, every hour: a user is due only in the single local hour their
  // reminder fires, so an hourly tick catches everyone in their own time zone.
  schedule("0 * * * *", () => {
    void sendDueReminders().catch((err) => {
      console.error("[reminders] scheduled send failed:", err);
    });
  });

  console.log("[reminders] in-process scheduler registered (hourly)");
}

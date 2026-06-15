import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { unsubscribeReminderForm } from "@/features/reminder/actions";
import { verifyUnsubscribeToken } from "@/features/reminder/unsubscribe";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

/**
 * One-click unsubscribe from weekly reminders, reached from the email link. PUBLIC
 * (no session) — authorized by the HMAC token over the user id. A GET only renders;
 * the actual opt-out is a POST (a bound server action behind a single button), so a
 * mail client prefetching the link can't unsubscribe anyone. No client JS.
 * Next 16: params + searchParams are async.
 */
export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string; token: string }>;
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const { userId, token } = await params;
  const { done, error } = await searchParams;
  const valid = verifyUnsubscribeToken(userId, token);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12 text-center">
      {!valid || error ? (
        <>
          <h1 className="font-serif text-2xl font-semibold">This link isn&apos;t valid</h1>
          <p className="mt-2 text-[13.5px] text-ink-soft">
            The unsubscribe link is invalid or has expired. You can turn reminders off anytime from
            Settings while signed in.
          </p>
        </>
      ) : done ? (
        <>
          <h1 className="font-serif text-2xl font-semibold">You&apos;re unsubscribed</h1>
          <p className="mt-2 text-[13.5px] text-ink-soft">
            You won&apos;t get weekly reminders anymore. You can turn them back on anytime from
            Settings.
          </p>
        </>
      ) : (
        <>
          <h1 className="font-serif text-2xl font-semibold">Turn off weekly reminders?</h1>
          <p className="mt-2 mb-6 text-[13.5px] text-ink-soft">
            You&apos;ll stop getting the weekly nudge to log your wins. You can re-enable it anytime
            from Settings.
          </p>
          <form action={unsubscribeReminderForm.bind(null, userId, token)} className="self-center">
            <Button type="submit">Turn off weekly reminders</Button>
          </form>
        </>
      )}
      <div className="mt-8 font-mono text-[10.5px] text-ink-faint">
        Powered by <span className="font-medium text-ink-soft">BragBit</span>
      </div>
    </main>
  );
}

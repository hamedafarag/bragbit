import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { unlockShareForm, type UnlockCode } from "../actions";

const MESSAGES: Record<UnlockCode, string> = {
  incorrect: "Incorrect password. Try again.",
  rate: "Too many attempts. Please wait a few minutes and try again.",
  unavailable: "This link isn't available.",
};

/**
 * The unlock gate for a password-protected share. A plain server-rendered `<form>`
 * posting to a bound server action — no client JS, so it works even with scripting
 * off and keeps the public page lean. On failure the action redirects back with a
 * `?e=<code>` that maps to fixed copy here; no document content is in the DOM until
 * the cookie is set and the page re-renders unlocked. Errors use the same vague
 * wording regardless of cause beyond what the code implies.
 */
export function ShareUnlock({ token, errorCode }: { token: string; errorCode?: string }) {
  const error = errorCode
    ? (MESSAGES[errorCode as UnlockCode] ?? "Couldn't unlock. Try again.")
    : null;

  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-xl border border-line bg-card p-6 shadow-card">
        <div className="mb-3 grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <Lock className="size-4" aria-hidden />
        </div>
        <h1 className="font-serif text-xl font-semibold">Password required</h1>
        <p className="mt-1 mb-5 text-[13px] text-ink-soft">
          This logbook is protected. Enter its password to view.
        </p>

        <form action={unlockShareForm.bind(null, token)} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="share-password" className="text-sm font-medium">
              Password
            </label>
            <Input id="share-password" name="password" type="password" autoFocus required />
          </div>
          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit">Unlock</Button>
        </form>
      </div>
    </main>
  );
}

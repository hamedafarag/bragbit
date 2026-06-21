import Link from "next/link";

import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { thumbUrl } from "@/lib/utils";

/**
 * App-wide top chrome for the authenticated `(app)` area. Shows the active
 * workspace identity (logo or wordmark) and a small user cluster (avatar →
 * profile, settings, sign out). Owners/admins also get a Workspace link into the
 * admin area. The accent is applied by the `(app)` layout wrapper.
 */
export function AppHeader({
  workspaceName,
  logoUrl,
  displayName,
  avatarUrl,
  initials,
  canAdminister,
}: {
  workspaceName: string;
  logoUrl: string | null;
  displayName: string;
  avatarUrl: string | null;
  initials: string;
  canAdminister: boolean;
}) {
  return (
    <header className="sticky top-0 z-50 flex h-[60px] items-center gap-4 border-b border-line bg-paper/85 px-4 backdrop-blur sm:px-6">
      <Link href="/dashboard" className="flex items-center gap-3 no-underline">
        {logoUrl ? (
          // Plain <img> with a `?w=` webp thumbnail from the files route (ENH-PERF-02). next/image
          // isn't used — the route is session-gated for avatars/attachments.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl(logoUrl, 400)}
            alt={workspaceName}
            className="h-8 w-auto max-w-[140px] object-contain"
          />
        ) : (
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary font-serif text-[17px] font-semibold text-primary-foreground shadow-[inset_0_-8px_14px_rgba(0,0,0,0.18)]">
            B
          </div>
        )}
        <div className="hidden sm:block">
          <div className="font-serif text-[17.5px] leading-none font-semibold text-ink">
            {workspaceName}
          </div>
          <div className="mt-0.5 font-mono text-[9.5px] tracking-[0.14em] text-ink-faint uppercase">
            Engineering Logbook
          </div>
        </div>
      </Link>

      {/* Global full-text search — a plain GET form (no JS) → /search?q=… */}
      <form action="/search" className="ml-5 hidden items-center sm:flex" role="search">
        <input
          type="search"
          name="q"
          placeholder="Search brags…"
          aria-label="Search brags"
          className="h-8 w-44 rounded-md border border-line bg-paper-deep/60 px-3 text-[13px] text-ink transition-[width,border-color] placeholder:text-ink-faint focus:w-56 focus:border-primary focus:ring-2 focus:ring-ring focus:outline-none"
        />
      </form>

      <div className="flex-1" />

      <nav className="flex items-center gap-1">
        {canAdminister ? (
          <Link
            href="/admin"
            className="rounded-md px-2.5 py-1.5 font-mono text-[11.5px] text-ink-soft no-underline hover:bg-accent hover:text-ink"
          >
            Workspace
          </Link>
        ) : null}
        <Link
          href="/settings"
          className="rounded-md px-2.5 py-1.5 font-mono text-[11.5px] text-ink-soft no-underline hover:bg-accent hover:text-ink"
        >
          Settings
        </Link>
        <SignOutButton />
        <Link
          href="/profile"
          aria-label="Your profile"
          className="ml-1 grid h-[30px] w-[30px] place-items-center overflow-hidden rounded-full border border-line bg-paper-deep font-mono text-[11px] font-medium text-ink-soft no-underline"
        >
          {avatarUrl ? (
            // Plain <img> with a `?w=` webp thumbnail (ENH-PERF-02); the session-gated files route
            // is unreachable by next/image's optimizer.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl(avatarUrl, 192)}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            initials
          )}
        </Link>
      </nav>
    </header>
  );
}

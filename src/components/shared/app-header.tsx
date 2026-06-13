import Link from "next/link";

import { SignOutButton } from "@/features/auth/components/sign-out-button";

/**
 * App-wide top chrome for the authenticated `(app)` area. Shows the active
 * workspace identity and a small user cluster (avatar → profile, settings, sign
 * out). Per-workspace branding (logo/accent) layers on in Phase 2.
 */
export function AppHeader({
  workspaceName,
  displayName,
  avatarUrl,
  initials,
}: {
  workspaceName: string;
  displayName: string;
  avatarUrl: string | null;
  initials: string;
}) {
  return (
    <header className="sticky top-0 z-50 flex h-[60px] items-center gap-4 border-b border-line bg-paper/85 px-6 backdrop-blur">
      <Link href="/" className="flex items-center gap-3 no-underline">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary font-serif text-[17px] font-semibold text-primary-foreground shadow-[inset_0_-8px_14px_rgba(0,0,0,0.18)]">
          B
        </div>
        <div>
          <div className="font-serif text-[17.5px] leading-none font-semibold text-ink">
            {workspaceName}
          </div>
          <div className="mt-0.5 font-mono text-[9.5px] tracking-[0.14em] text-ink-faint uppercase">
            Engineering Logbook
          </div>
        </div>
      </Link>

      <div className="flex-1" />

      <nav className="flex items-center gap-1">
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
            // Authorizing same-origin route, not an optimizable static asset.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </Link>
      </nav>
    </header>
  );
}

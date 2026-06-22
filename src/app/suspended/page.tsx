import { SignOutButton } from "@/features/auth/components/sign-out-button";

/**
 * Terminal page for a suspended account or workspace (PLAN §10 — instance
 * superadmin). The (app) gate bounces here when the active workspace or the account
 * is suspended; the only action is to sign out. Lives outside the (app) group so it
 * never re-triggers the suspension bounce.
 */
export default function SuspendedPage() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="max-w-md rounded-xl border border-line bg-card p-8 text-center shadow-card">
        <h1 className="mb-2 font-serif text-xl font-semibold">Access suspended</h1>
        <p className="mb-6 text-[13px] text-ink-soft">
          This workspace or account has been suspended by the instance administrator. If you believe
          this is a mistake, please contact them.
        </p>
        <SignOutButton />
      </div>
    </div>
  );
}

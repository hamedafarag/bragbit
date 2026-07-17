import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { requireSuperadmin } from "@/lib/auth/guards";

/**
 * Instance-superadmin console shell (PLAN §10). `requireSuperadmin` 404s anyone not
 * on the SUPERADMIN_EMAILS allowlist. Deliberately NOT in the (app) group — a
 * superadmin needs no workspace, and this surface never renders brag content.
 */
export default async function SuperLayout({ children }: { children: React.ReactNode }) {
  await requireSuperadmin();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 flex h-[60px] items-center gap-3 border-b border-line bg-paper/85 px-6 backdrop-blur">
        <span className="font-serif text-[17px] font-semibold text-ink">BragBit</span>
        <span className="font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase">
          Instance admin
        </span>
        <div className="flex-1" />
        <SignOutButton />
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}

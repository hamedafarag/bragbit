import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { getSessionOrNull, getWorkspaceOrNull } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "No workspace",
  robots: { index: false, follow: false },
};

/**
 * Terminal page for an authenticated session that has no accessible workspace — most
 * often a member who was removed but still holds an account and a live session.
 *
 * Without it, such a session ping-pongs `/dashboard → / → /dashboard` forever
 * (ENH-CQ-07): the workspace guard bounces a workspace-less caller to `/`, and the
 * root dispatcher sends any signed-in caller back to the dashboard. This page is the
 * loop's exit — `requireWorkspace` redirects here instead of `/`, and it never
 * redirects a workspace-less caller onward. A caller who *does* have a workspace
 * (or no session at all) is sent on so nobody can get stranded here.
 */
export default async function NoWorkspacePage() {
  const session = await getSessionOrNull();
  if (!session) redirect("/sign-in");
  if (await getWorkspaceOrNull()) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12 text-center">
      <h1 className="font-serif text-2xl font-semibold">No workspace access</h1>
      <p className="mt-2 mb-6 text-[13.5px] text-ink-soft">
        Your account isn&apos;t a member of any workspace right now — an admin may have removed your
        access. If you think this is a mistake, ask an admin to invite you again. Otherwise you can
        sign out.
      </p>
      <div className="self-center">
        <SignOutButton />
      </div>
      <div className="mt-8 font-mono text-[10.5px] text-ink-faint">
        Powered by <span className="font-medium text-ink-soft">BragBit</span>
      </div>
    </main>
  );
}

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { isInstanceSetup } from "@/features/setup/queries";
import { auth } from "@/lib/auth";
import { isPrivate } from "@/lib/instance";

// Shared chrome + gating for the auth pages. Before setup (private modes) there's
// no one to sign in → /setup; already signed in → the app.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (isPrivate() && !(await isInstanceSetup())) redirect("/setup");

  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/");

  return (
    <main className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary font-serif text-lg font-semibold text-primary-foreground shadow-[inset_0_-8px_14px_rgba(0,0,0,0.18)]">
          B
        </div>
        <div className="font-serif text-xl leading-none font-semibold">BragBit</div>
      </div>
      {children}
    </main>
  );
}

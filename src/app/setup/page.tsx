import { notFound, redirect } from "next/navigation";

import { SetupForm } from "@/features/setup/components/setup-form";
import { isInstanceSetup } from "@/features/setup/queries";
import { env } from "@/lib/env";
import { instanceMode, isHosted } from "@/lib/instance";

// First-run wizard. Private modes only; closes permanently once a workspace exists.
export default async function SetupPage() {
  if (isHosted()) notFound();
  if (await isInstanceSetup()) redirect("/");

  const mode = instanceMode as "private-org" | "private-solo";

  return (
    <main className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary font-serif text-lg font-semibold text-primary-foreground shadow-[inset_0_-8px_14px_rgba(0,0,0,0.18)]">
          B
        </div>
        <div>
          <div className="font-serif text-xl leading-none font-semibold">Set up BragBit</div>
          <div className="mt-1 font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase">
            {mode === "private-org" ? "Organization instance" : "Personal instance"}
          </div>
        </div>
      </div>

      <p className="mb-6 text-[13.5px] text-ink-soft">
        Create the owner account and your {mode === "private-org" ? "organization" : "workspace"}.
        This first-run wizard closes once it&apos;s done.
      </p>

      <div className="rounded-xl border border-line bg-card p-6 shadow-card">
        <SetupForm mode={mode} requiresToken={Boolean(env.SETUP_TOKEN)} />
      </div>
    </main>
  );
}

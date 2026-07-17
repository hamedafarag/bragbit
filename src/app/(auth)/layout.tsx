import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AccentStyle } from "@/components/shared/accent-style";
import { isInstanceSetup } from "@/features/setup/queries";
import { getInstanceBranding } from "@/features/workspace/queries";
import { auth } from "@/lib/auth";
import { thumbUrl } from "@/lib/utils";

// Shared chrome + gating for the auth pages. Before setup there's no one to sign
// in → /setup; already signed in → the app. Pre-auth surfaces show the instance
// brand (the sole workspace).
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (!(await isInstanceSetup())) redirect("/setup");

  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/");

  const brand = await getInstanceBranding();
  const name = brand?.name ?? "BragBit";
  const logoUrl = brand?.logoKey ? `/api/files/${brand.logoKey}` : null;

  return (
    <main className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <AccentStyle accent={brand?.accentColor} />
      <div className="mb-8 flex items-center gap-3">
        {logoUrl ? (
          // Plain <img> served as a `?w=` webp thumbnail (ENH-PERF-02); next/image can't fetch the session-gated files route.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl(logoUrl, 400)}
            alt={name}
            className="h-9 w-auto max-w-[160px] object-contain"
          />
        ) : (
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary font-serif text-lg font-semibold text-primary-foreground shadow-[inset_0_-8px_14px_rgba(0,0,0,0.18)]">
            B
          </div>
        )}
        <div className="font-serif text-xl leading-none font-semibold">{name}</div>
      </div>
      {children}
    </main>
  );
}

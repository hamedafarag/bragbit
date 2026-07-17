import { Check, Plug } from "lucide-react";
import { redirect } from "next/navigation";

import { AccentStyle } from "@/components/shared/accent-style";
import { ConsentActions } from "@/features/oauth-clients/components/consent-actions";
import { getOAuthClientByClientId } from "@/features/oauth-clients/queries";
import { getInstanceBranding } from "@/features/workspace/queries";
import { getSessionOrNull } from "@/lib/auth/guards";
import { describeScope } from "@/lib/mcp/scopes";

// OAuth consent screen (Better Auth mcp plugin `consentPage`). Reached only mid
// authorize-flow, after the user is signed in, when the client asks for consent.
// Uses the root layout (NOT the (auth) group, which bounces signed-in users).
// Next 16: searchParams is async.
export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ consent_code?: string; client_id?: string; scope?: string }>;
}) {
  // Consent requires a signed-in user; the normal flow guarantees one by here.
  const session = await getSessionOrNull();
  if (!session) redirect("/sign-in");

  const { consent_code: consentCode, client_id: clientId, scope } = await searchParams;
  const brand = await getInstanceBranding();
  const instanceName = brand?.name ?? "BragBit";

  const client = clientId ? await getOAuthClientByClientId(clientId) : null;
  const scopes = (scope ?? "").split(" ").filter(Boolean);

  const invalid = !consentCode || !clientId || !client;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <AccentStyle accent={brand?.accentColor} />
      <div className="mb-8 flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary font-serif text-lg font-semibold text-primary-foreground shadow-[inset_0_-8px_14px_rgba(0,0,0,0.18)]">
          {instanceName.charAt(0).toUpperCase()}
        </div>
        <div className="font-serif text-xl leading-none font-semibold">{instanceName}</div>
      </div>

      <div className="rounded-xl border border-line bg-card p-6 shadow-card">
        {invalid ? (
          <>
            <h1 className="mb-1 font-serif text-xl font-semibold">Authorization link invalid</h1>
            <p className="text-[13px] text-ink-soft">
              This authorization request is missing information or has expired. Start the connection
              again from your AI assistant.
            </p>
          </>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2 text-ink-soft">
              <Plug className="h-4 w-4" aria-hidden />
              <span className="font-mono text-[10px] tracking-[0.14em] uppercase">
                Connect an app
              </span>
            </div>
            <h1 className="mb-1 font-serif text-xl font-semibold">Authorize {client.name}</h1>
            <p className="mb-5 text-[13px] text-ink-soft">
              <span className="font-medium text-ink">{client.name}</span> wants to connect to your{" "}
              {instanceName} account. Signed in as{" "}
              <span className="font-medium text-ink">{session.user.email}</span>.
            </p>

            <p className="mb-2 text-[12px] font-medium text-ink">It will be able to:</p>
            <ul className="flex flex-col gap-2">
              {scopes.map((s) => (
                <li key={s} className="flex items-start gap-2 text-[13px] text-ink-soft">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span>{describeScope(s)}</span>
                </li>
              ))}
            </ul>

            <ConsentActions consentCode={consentCode} />

            <p className="mt-5 text-[11.5px] text-ink-faint">
              You can revoke this access anytime in Settings → Connected apps.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

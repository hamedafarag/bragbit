import { OAuthButtons } from "@/features/auth/components/oauth-buttons";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { configuredOAuthProviders } from "@/lib/oauth";

// Where Better Auth's mcp plugin serves the OAuth authorize endpoint.
const MCP_AUTHORIZE_PATH = "/api/auth/mcp/authorize";

/**
 * When an unauthenticated user hits /api/auth/mcp/authorize, the mcp plugin
 * redirects them to /sign-in with the original authorize query appended. If those
 * OAuth markers are present, build the URL to hand back to after sign-in so the
 * connect flow resumes; otherwise return null (normal sign-in → app).
 */
function buildMcpAuthorizeResume(
  params: Record<string, string | string[] | undefined>,
): string | null {
  if (typeof params.client_id !== "string" || typeof params.response_type !== "string") {
    return null;
  }
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "error") continue;
    if (typeof value === "string") qs.set(key, value);
  }
  return `${MCP_AUTHORIZE_PATH}?${qs.toString()}`;
}

// Next 16: searchParams is async.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const resumeUrl = buildMcpAuthorizeResume(params);
  const providers = configuredOAuthProviders();

  return (
    <div className="rounded-xl border border-line bg-card p-6 shadow-card">
      <h1 className="mb-1 font-serif text-xl font-semibold">Sign in</h1>
      <p className="mb-6 text-[13px] text-ink-soft">Welcome back to your logbook.</p>

      {error ? (
        <p className="mb-5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive">
          {error === "signup_disabled"
            ? "No BragBit account is linked to that identity. Accounts here are invitation-only — ask an admin to invite you, then link the provider from your account."
            : "We couldn't sign you in with that provider. Try again, or use your email and password."}
        </p>
      ) : null}

      <SignInForm redirectTo={resumeUrl ?? undefined} />
      <OAuthButtons providers={providers} callbackURL={resumeUrl ?? undefined} />
    </div>
  );
}

import { OAuthButtons } from "@/features/auth/components/oauth-buttons";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { configuredOAuthProviders } from "@/lib/oauth";

// Next 16: searchParams is async.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
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

      <SignInForm />
      <OAuthButtons providers={providers} />
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";

import { OAuthButtons } from "@/features/auth/components/oauth-buttons";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { isHosted } from "@/lib/instance";
import { configuredOAuthProviders } from "@/lib/oauth";

/**
 * Open signup — hosted instances only (PLAN §10). The private (invitation-only)
 * modes have no public signup, so this route bounces to sign-in. Each new account
 * is given a personal workspace by the user-create hook in @/lib/auth.
 */
export default function SignUpPage() {
  if (!isHosted()) redirect("/sign-in");
  const providers = configuredOAuthProviders();

  return (
    <div className="rounded-xl border border-line bg-card p-6 shadow-card">
      <h1 className="mb-1 font-serif text-xl font-semibold">Create your account</h1>
      <p className="mb-6 text-[13px] text-ink-soft">
        Start your logbook — we&apos;ll email you a link to verify your address.
      </p>

      <SignUpForm />
      <OAuthButtons providers={providers} />

      <p className="mt-6 text-center text-[12.5px] text-ink-soft">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-ink underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

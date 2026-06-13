import { SignInForm } from "@/features/auth/components/sign-in-form";

export default function SignInPage() {
  return (
    <div className="rounded-xl border border-line bg-card p-6 shadow-card">
      <h1 className="mb-1 font-serif text-xl font-semibold">Sign in</h1>
      <p className="mb-6 text-[13px] text-ink-soft">Welcome back to your logbook.</p>
      <SignInForm />
    </div>
  );
}

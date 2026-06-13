import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="rounded-xl border border-line bg-card p-6 shadow-card">
      <h1 className="mb-1 font-serif text-xl font-semibold">Forgot password</h1>
      <p className="mb-6 text-[13px] text-ink-soft">
        Enter your email and we&apos;ll send a link to reset it.
      </p>
      <ForgotPasswordForm />
    </div>
  );
}

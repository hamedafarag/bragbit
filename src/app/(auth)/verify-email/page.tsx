import { ResendVerificationForm } from "@/features/auth/components/resend-verification-form";

export default function VerifyEmailPage() {
  return (
    <div className="rounded-xl border border-line bg-card p-6 shadow-card">
      <h1 className="mb-1 font-serif text-xl font-semibold">Verify your email</h1>
      <p className="mb-6 text-[13px] text-ink-soft">
        We sent you a verification link. Didn&apos;t get it? Resend it below.
      </p>
      <ResendVerificationForm />
    </div>
  );
}

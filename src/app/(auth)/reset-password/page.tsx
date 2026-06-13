import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

// Next 16: searchParams is async.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="rounded-xl border border-line bg-card p-6 shadow-card">
      <h1 className="mb-1 font-serif text-xl font-semibold">Set a new password</h1>
      <p className="mb-6 text-[13px] text-ink-soft">Choose a new password for your account.</p>
      <ResetPasswordForm token={token ?? null} />
    </div>
  );
}

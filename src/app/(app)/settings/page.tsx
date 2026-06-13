import { ChangeEmailForm } from "@/features/account/components/change-email-form";
import { ChangePasswordForm } from "@/features/account/components/change-password-form";
import { DeleteAccountForm } from "@/features/account/components/delete-account-form";
import { getActiveWorkspace } from "@/features/workspace/queries";

export default async function SettingsPage() {
  const { user, workspace } = await getActiveWorkspace();

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-serif text-[28px] leading-tight font-semibold tracking-[-0.01em]">
          Account settings
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-soft">
          Manage how you sign in. These control your account, not your workspace.
        </p>
      </header>

      <section className="rounded-xl border border-line bg-card p-6 shadow-card">
        <h2 className="mb-1 font-serif text-lg font-semibold">Email address</h2>
        <p className="mb-5 text-[13px] text-ink-soft">
          Changing your email sends a confirmation link to your current inbox; the change applies
          only after you click it.
        </p>
        <ChangeEmailForm currentEmail={user.email} />
      </section>

      <section className="rounded-xl border border-line bg-card p-6 shadow-card">
        <h2 className="mb-1 font-serif text-lg font-semibold">Password</h2>
        <p className="mb-5 text-[13px] text-ink-soft">
          Choose a strong password. Changing it signs out your other sessions.
        </p>
        <ChangePasswordForm />
      </section>

      <section className="rounded-xl border border-dashed border-destructive/40 bg-card p-6 shadow-card">
        <h2 className="mb-1 font-serif text-lg font-semibold text-destructive">Danger zone</h2>
        <p className="mb-5 text-[13px] text-ink-soft">
          Delete your account and your data. This can&apos;t be undone.
        </p>
        <DeleteAccountForm isSoloOwner={workspace.type === "personal"} />
      </section>
    </div>
  );
}

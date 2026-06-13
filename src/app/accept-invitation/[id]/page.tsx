import { AcceptForm } from "@/features/invitation/components/accept-form";
import { getPendingInvitation } from "@/features/invitation/queries";

// Next 16: params is async.
export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invite = await getPendingInvitation(id);

  return (
    <main className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary font-serif text-lg font-semibold text-primary-foreground shadow-[inset_0_-8px_14px_rgba(0,0,0,0.18)]">
          B
        </div>
        <div className="font-serif text-xl leading-none font-semibold">BragBit</div>
      </div>

      <div className="rounded-xl border border-line bg-card p-6 shadow-card">
        {invite ? (
          <>
            <h1 className="mb-1 font-serif text-xl font-semibold">
              Join {invite.organizationName}
            </h1>
            <p className="mb-6 text-[13px] text-ink-soft">
              You&apos;ve been invited as <span className="text-ink">{invite.role}</span>. Set up
              your account to accept.
            </p>
            <AcceptForm
              invitationId={invite.id}
              email={invite.email}
              organizationName={invite.organizationName}
            />
          </>
        ) : (
          <>
            <h1 className="mb-1 font-serif text-xl font-semibold">Invitation unavailable</h1>
            <p className="text-[13px] text-ink-soft">
              This invitation is invalid, already used, or expired. Ask an admin to send a new one.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

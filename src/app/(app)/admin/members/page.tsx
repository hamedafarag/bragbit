import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { InviteForm } from "@/features/workspace/components/invite-form";
import { MemberRoleSelect } from "@/features/workspace/components/member-role-select";
import { PendingInvitationActions } from "@/features/workspace/components/pending-invitation-actions";
import {
  getActiveWorkspace,
  listMembers,
  listPendingInvitations,
  type MemberRow,
} from "@/features/workspace/queries";

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function MembersPage() {
  const { user, workspace } = await getActiveWorkspace();
  // Personal workspaces have no member/invite surface (PLAN §3).
  if (workspace.type !== "organization") redirect("/admin");

  const [members, pending] = await Promise.all([listMembers(), listPendingInvitations()]);

  const editable = (m: MemberRow) => m.role !== "owner" && m.userId !== user.id;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-serif text-[28px] leading-tight font-semibold tracking-[-0.01em]">
          Members
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-soft">
          Invite people to {workspace.name} and manage their roles. Brags stay private to each
          member — admins manage the workspace, never its content.
        </p>
      </header>

      <section className="rounded-xl border border-line bg-card p-6 shadow-card">
        <h2 className="mb-1 font-serif text-lg font-semibold">Invite people</h2>
        <p className="mb-5 text-[13px] text-ink-soft">
          They&apos;ll get a branded link (valid 7 days) to set up their account.
        </p>
        <InviteForm />
      </section>

      <section className="rounded-xl border border-line bg-card shadow-card">
        <div className="border-b border-line-soft px-6 py-4">
          <h2 className="font-serif text-lg font-semibold">
            Members <span className="font-mono text-[12px] text-ink-faint">· {members.length}</span>
          </h2>
        </div>
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="border-b border-line-soft font-mono text-[10px] tracking-[0.12em] text-ink-faint uppercase">
              <th className="px-6 py-2.5 text-left font-medium">Member</th>
              <th className="px-6 py-2.5 text-left font-medium">Role</th>
              <th className="px-6 py-2.5 text-left font-medium">Joined</th>
              <th className="px-6 py-2.5 text-left font-medium">Last active</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.memberId} className="border-b border-line-soft last:border-0">
                <td className="px-6 py-3">
                  <div className="font-medium text-ink">{m.name}</div>
                  <div className="font-mono text-[11px] text-ink-faint">{m.email}</div>
                </td>
                <td className="px-6 py-3">
                  {editable(m) ? (
                    <MemberRoleSelect memberId={m.memberId} role={m.role} />
                  ) : (
                    <Badge variant="outline" className="capitalize">
                      {m.role}
                      {m.userId === user.id ? " · you" : ""}
                    </Badge>
                  )}
                </td>
                <td className="px-6 py-3 font-mono text-[12px] text-ink-soft">
                  {fmtDate(m.joinedAt)}
                </td>
                <td className="px-6 py-3 font-mono text-[12px] text-ink-soft">
                  {m.lastActiveAt ? fmtDate(m.lastActiveAt) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {pending.length > 0 ? (
        <section className="rounded-xl border border-line bg-card shadow-card">
          <div className="border-b border-line-soft px-6 py-4">
            <h2 className="font-serif text-lg font-semibold">
              Pending invitations{" "}
              <span className="font-mono text-[12px] text-ink-faint">· {pending.length}</span>
            </h2>
          </div>
          <ul>
            {pending.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center gap-3 border-b border-line-soft px-6 py-3 last:border-0"
              >
                <div className="mr-auto">
                  <div className="text-[13.5px] font-medium text-ink">{inv.email}</div>
                  <div className="font-mono text-[11px] text-ink-faint">
                    <span className="capitalize">{inv.role}</span> · expires{" "}
                    {fmtDate(inv.expiresAt)}
                  </div>
                </div>
                <PendingInvitationActions invitationId={inv.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

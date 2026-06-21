import { QuotaInput } from "@/features/super/components/quota-input";
import { SuspendToggle } from "@/features/super/components/suspend-toggle";
import { listUsersForSuper, listWorkspacesForSuper } from "@/features/super/queries";
import { env } from "@/lib/env";

const ymd = (d: Date) => new Date(d).toISOString().slice(0, 10);

function SuspendedBadge() {
  return (
    <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
      Suspended
    </span>
  );
}

export default async function SuperPage() {
  const [workspaces, users] = await Promise.all([listWorkspacesForSuper(), listUsersForSuper()]);

  return (
    <div className="flex flex-col gap-10">
      <header>
        <h1 className="font-serif text-[28px] leading-tight font-semibold tracking-[-0.01em]">
          Instance admin
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-soft">
          Operate the hosted instance — suspend abusive workspaces or accounts and set storage
          quotas. Member content (documents and brags) is never shown here.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-lg font-semibold">Workspaces ({workspaces.length})</h2>
        <div className="overflow-x-auto rounded-xl border border-line bg-card shadow-card">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-line font-mono text-[10.5px] tracking-wide text-ink-faint uppercase">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Members</th>
                <th className="px-4 py-2.5">Created</th>
                <th className="px-4 py-2.5">Quota (MB)</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {workspaces.map((w) => (
                <tr key={w.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-ink">{w.name}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{w.type}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{w.memberCount}</td>
                  <td className="px-4 py-2.5 font-mono text-[11.5px] text-ink-soft">
                    {ymd(w.createdAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <QuotaInput
                      orgId={w.id}
                      quotaMb={w.storageQuotaMb}
                      defaultQuotaMb={env.WORKSPACE_QUOTA_MB}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    {w.suspendedAt ? (
                      <SuspendedBadge />
                    ) : (
                      <span className="text-ink-faint">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <SuspendToggle kind="workspace" id={w.id} suspended={w.suspendedAt != null} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-lg font-semibold">
          Accounts &amp; signups ({users.length})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-line bg-card shadow-card">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-line font-mono text-[10.5px] tracking-wide text-ink-faint uppercase">
              <tr>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Verified</th>
                <th className="px-4 py-2.5">Joined</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-ink">{u.email}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{u.name}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{u.emailVerified ? "Yes" : "No"}</td>
                  <td className="px-4 py-2.5 font-mono text-[11.5px] text-ink-soft">
                    {ymd(u.createdAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    {u.suspendedAt ? (
                      <SuspendedBadge />
                    ) : (
                      <span className="text-ink-faint">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <SuspendToggle kind="user" id={u.id} suspended={u.suspendedAt != null} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

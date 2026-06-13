import { AppHeader } from "@/components/shared/app-header";
import { getProfile } from "@/features/profile/queries";
import { getActiveWorkspace } from "@/features/workspace/queries";
import { initials } from "@/lib/utils";

// Authenticated, workspace-scoped shell (PLAN.md §6). getActiveWorkspace runs
// the DAL guards (session + membership) and redirects out if either is missing;
// the active-workspace-on-sign-in hook (lib/auth) guarantees a plain sign-in
// resolves here rather than bouncing.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, workspace } = await getActiveWorkspace();
  const profile = await getProfile(user.id);

  const displayName = profile?.displayName ?? user.name;
  const avatarUrl = profile?.avatarKey ? `/api/files/${profile.avatarKey}` : null;

  return (
    <div className="relative z-10 min-h-screen">
      <AppHeader
        workspaceName={workspace.name}
        displayName={displayName}
        avatarUrl={avatarUrl}
        initials={initials(displayName)}
      />
      <main className="mx-auto max-w-[760px] px-6 py-10">{children}</main>
    </div>
  );
}

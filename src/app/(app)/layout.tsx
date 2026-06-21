import { AppHeader } from "@/components/shared/app-header";
import { getProfile } from "@/features/profile/queries";
import { getActiveWorkspace } from "@/features/workspace/queries";
import { allowsOrgCreation } from "@/lib/instance";
import { accentVars, initials } from "@/lib/utils";

// Authenticated, workspace-scoped shell (PLAN.md §6). getActiveWorkspace runs
// the DAL guards (session + membership) and redirects out if either is missing;
// the active-workspace-on-sign-in hook (lib/auth) guarantees a plain sign-in
// resolves here rather than bouncing. The wrapper applies the workspace accent
// so all `--primary` / `--ring` chrome below it is branded.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, workspace, role } = await getActiveWorkspace();
  const profile = await getProfile(user.id);

  const displayName = profile?.displayName ?? user.name;
  const avatarUrl = profile?.avatarKey ? `/api/files/${profile.avatarKey}` : null;
  const logoUrl = workspace.logoKey ? `/api/files/${workspace.logoKey}` : null;
  const canAdminister = role === "owner" || role === "admin";

  return (
    <div className="relative z-10 min-h-screen" style={accentVars(workspace.accentColor)}>
      {/* Keyboard users can jump past the header/nav straight to the page content. */}
      <a
        href="#main-content"
        className="sr-only rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]"
      >
        Skip to content
      </a>
      <AppHeader
        workspaceName={workspace.name}
        logoUrl={logoUrl}
        displayName={displayName}
        avatarUrl={avatarUrl}
        initials={initials(displayName)}
        canAdminister={canAdminister}
        canCreateOrg={allowsOrgCreation()}
      />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-[760px] px-6 py-10 focus:outline-none"
      >
        {children}
      </main>
    </div>
  );
}

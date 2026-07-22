import { redirect } from "next/navigation";

import { AdminNav } from "@/features/workspace/components/admin-nav";
import { getActiveWorkspace } from "@/features/workspace/queries";
import { canAdminister } from "@/features/workspace/roles";

// Workspace administration is owner/admin only. getActiveWorkspace runs the DAL
// membership guard; we additionally require an administering role here. (In a
// personal workspace the sole member is the owner, so the owner reaches their
// own workspace settings; the Members tab is hidden for personal workspaces.)
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { workspace, role } = await getActiveWorkspace();
  // Non-admins go straight to the dashboard, not "/" — the root dispatcher would
  // only bounce a signed-in caller back to /dashboard anyway (one extra 307). ENH-CQ-06.
  if (!canAdminister(role)) redirect("/dashboard");

  return (
    // Admin is data-dense (the members table), so it breaks out of the 760px
    // prose shell to a wider, viewport-centered column. The nav lives here too
    // so the tabs stay aligned with the tab content below.
    <div className="content-wide flex flex-col gap-6">
      <AdminNav isOrg={workspace.type === "organization"} />
      {children}
    </div>
  );
}

import { redirect } from "next/navigation";

import { AdminNav } from "@/features/workspace/components/admin-nav";
import { getActiveWorkspace } from "@/features/workspace/queries";

// Workspace administration is owner/admin only. getActiveWorkspace runs the DAL
// membership guard; we additionally require an administering role here. (In a
// personal workspace the sole member is the owner, so the owner reaches their
// own workspace settings; the Members tab is hidden for personal workspaces.)
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { workspace, role } = await getActiveWorkspace();
  if (role !== "owner" && role !== "admin") redirect("/");

  return (
    <div className="flex flex-col gap-6">
      <AdminNav isOrg={workspace.type === "organization"} />
      {children}
    </div>
  );
}

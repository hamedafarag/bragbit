import { requireRole } from "@/lib/auth/guards";

// Workspace administration is owner/admin only; the role gate lives in the DAL.
// Members are redirected to the app root. (In a personal workspace the sole
// member is the owner, so the owner reaches their own workspace settings.)
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("owner", "admin");
  return children;
}

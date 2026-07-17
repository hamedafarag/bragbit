import { redirect } from "next/navigation";

import { CreateOrgForm } from "@/features/workspace/components/create-org-form";
import { allowsOrgCreation } from "@/lib/instance";

/**
 * Create a new organization workspace — hosted only (PLAN §10). The private modes
 * have a single fixed workspace, so this route redirects to the dashboard there.
 * The (app) layout has already enforced the session + an active workspace.
 */
export default function NewOrganizationPage() {
  if (!allowsOrgCreation()) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 font-serif text-2xl font-semibold">Create an organization</h1>
      <p className="mb-6 text-[13px] text-ink-soft">
        A shared workspace for your team. You become its owner and can invite members and set
        branding.
      </p>
      <CreateOrgForm />
    </div>
  );
}

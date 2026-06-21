"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createOrganizationWorkspace } from "../actions";
import { createOrgSchema } from "../schema";

/**
 * Create-organization form (hosted only). Calls the server action, which makes the
 * caller the owner and switches the active workspace to the new org; then lands on
 * the dashboard so they're already inside it.
 */
export function CreateOrgForm() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = createOrgSchema.safeParse({ name: String(fd.get("name") ?? "") });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }

    start(async () => {
      const res = await createOrganizationWorkspace(parsed.data);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Organization created.");
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Organization name</Label>
        <Input id="name" name="name" type="text" autoComplete="organization" required />
      </div>
      <Button type="submit" disabled={pending} className="mt-1">
        {pending ? "Creating…" : "Create organization"}
      </Button>
    </form>
  );
}

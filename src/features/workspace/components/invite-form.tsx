"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { inviteMembers } from "../actions";
import { inviteSchema, type InviteRole } from "../schema";

export function InviteForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [role, setRole] = useState<InviteRole>("member");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const raw = String(new FormData(form).get("emails") ?? "");
    const emails = [
      ...new Set(
        raw
          .split(/[\s,;]+/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];

    const parsed = inviteSchema.safeParse({ emails, role });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }

    start(async () => {
      const result = await inviteMembers(parsed.data);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const failedList = result.failures.map((f) => f.email).join(", ");
      if (result.failures.length === 0) {
        toast.success(`Invited ${result.invited} ${result.invited === 1 ? "person" : "people"}.`);
      } else if (result.invited > 0) {
        toast.warning(`Invited ${result.invited}; couldn't invite ${failedList}.`);
      } else {
        toast.error(`Couldn't invite ${failedList} — ${result.failures[0]?.error}.`);
      }
      form.reset();
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="emails">Email addresses</Label>
        <Textarea
          id="emails"
          name="emails"
          rows={3}
          placeholder="ada@company.com, grace@company.com"
          required
        />
        <p className="font-mono text-[10.5px] text-ink-faint">
          One or more, separated by commas, spaces, or new lines.
        </p>
      </div>
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-role">Role</Label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as InviteRole)}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send invitations"}
        </Button>
      </div>
    </form>
  );
}

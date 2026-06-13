"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { changeMemberRole } from "../actions";
import { INVITE_ROLES } from "../schema";

/** Role picker for one (non-owner, non-self) member. Better Auth enforces the rules. */
export function MemberRoleSelect({ memberId, role }: { memberId: string; role: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const select = e.currentTarget;
    const next = select.value;
    if (next === role) return;
    start(async () => {
      const result = await changeMemberRole(memberId, next);
      if (result.ok) {
        toast.success("Role updated.");
        router.refresh();
      } else {
        toast.error(result.error);
        select.value = role; // revert the visible selection
      }
    });
  }

  return (
    <select
      defaultValue={role}
      disabled={pending}
      onChange={onChange}
      aria-label="Member role"
      className="h-8 rounded-md border border-input bg-card px-2 text-xs shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
    >
      {INVITE_ROLES.map((r) => (
        <option key={r} value={r}>
          {r[0]!.toUpperCase() + r.slice(1)}
        </option>
      ))}
    </select>
  );
}

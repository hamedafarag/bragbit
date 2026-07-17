"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { setWorkspaceQuota } from "../actions";

/**
 * Per-workspace storage-quota override (MB) in the /super console. Blank = the
 * instance default (shown as the placeholder). Saves through the superadmin action.
 */
export function QuotaInput({
  orgId,
  quotaMb,
  defaultQuotaMb,
}: {
  orgId: string;
  quotaMb: number | null;
  defaultQuotaMb: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(quotaMb?.toString() ?? "");
  const [pending, start] = useTransition();

  function save() {
    const trimmed = value.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && (!Number.isInteger(next) || next <= 0)) {
      toast.error("Enter a positive whole number of MB, or leave blank for the default.");
      return;
    }
    start(async () => {
      const res = await setWorkspaceQuota(orgId, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Quota updated.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={String(defaultQuotaMb)}
        aria-label="Storage quota in MB"
        className="h-8 w-24"
      />
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={save}>
        Save
      </Button>
    </div>
  );
}

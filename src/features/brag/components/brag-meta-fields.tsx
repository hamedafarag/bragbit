"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { BRAG_CATEGORIES } from "../schema";

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const selectClass =
  "h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/**
 * Date / category / status row of the brag editor. Uncontrolled (read via
 * FormData on submit); split out of BragEditor (ENH-CQ-03). Defaults to today's
 * local date when none is given.
 */
export function BragMetaFields({
  date,
  category,
  status,
}: {
  date?: string;
  category?: string;
  status?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="brag-date">Date</Label>
        <Input id="brag-date" name="date" type="date" defaultValue={date ?? todayLocal()} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="brag-category">Category</Label>
        <select
          id="brag-category"
          name="category"
          defaultValue={category ?? ""}
          className={selectClass}
        >
          <option value="">— None —</option>
          {BRAG_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="brag-status">Status</Label>
        <select id="brag-status" name="status" defaultValue={status ?? ""} className={selectClass}>
          <option value="">— None —</option>
          <option value="shipped">Shipped</option>
          <option value="in_progress">In progress</option>
        </select>
      </div>
    </div>
  );
}

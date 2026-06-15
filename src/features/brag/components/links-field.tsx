"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type LinkRow = { url: string; label: string };

/**
 * Controlled, repeatable list of brag links (URL + optional label). The parent
 * (the editor) owns the array and submits it; rows are fully controlled, so
 * add/remove can key by index without value drift. Order here is persisted as the
 * link position.
 */
export function LinksField({
  value,
  onChange,
}: {
  value: LinkRow[];
  onChange: (rows: LinkRow[]) => void;
}) {
  const update = (i: number, patch: Partial<LinkRow>) =>
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const add = () => onChange([...value, { url: "", label: "" }]);
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-2">
      {value.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={row.url}
            onChange={(e) => update(i, { url: e.target.value })}
            placeholder="https://github.com/org/repo/pull/1482"
            inputMode="url"
            className="flex-1"
            aria-label={`Link ${i + 1} URL`}
          />
          <Input
            value={row.label}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder="PR #1482"
            className="w-32 shrink-0"
            aria-label={`Link ${i + 1} label`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-ink-faint hover:text-destructive"
            onClick={() => remove(i)}
            aria-label={`Remove link ${i + 1}`}
          >
            <X />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={add}>
        + Add link
      </Button>
    </div>
  );
}

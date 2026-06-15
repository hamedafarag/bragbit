"use client";

import { X } from "lucide-react";
import { useId, useState } from "react";

/**
 * Controlled tag input: type a name and press Enter or comma to add a chip,
 * Backspace on an empty input removes the last. Names normalize to lowercase and
 * dedupe (the action re-normalizes server-side). The datalist offers the caller's
 * existing tags so the vocabulary stays tidy. Chips are monochrome (#name).
 */
export function TagsField({
  value,
  onChange,
  suggestions,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
}) {
  const [draft, setDraft] = useState("");
  const listId = useId();

  function add(raw: string) {
    const name = raw.trim().toLowerCase();
    if (name && !value.includes(name)) onChange([...value, name]);
    setDraft("");
  }
  function remove(name: string) {
    onChange(value.filter((t) => t !== name));
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      remove(value[value.length - 1]!);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-ring">
        {value.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded bg-paper-deep px-1.5 py-0.5 font-mono text-[11px] text-ink-soft"
          >
            <span className="text-ink-faint">#</span>
            {t}
            <button
              type="button"
              onClick={() => remove(t)}
              aria-label={`Remove tag ${t}`}
              className="text-ink-faint hover:text-destructive"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          list={listId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          placeholder={value.length > 0 ? "" : "Add tags — Enter or comma to confirm"}
          className="min-w-[10rem] flex-1 border-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label="Add a tag"
        />
      </div>
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}

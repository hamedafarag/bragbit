"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { BRAG_CATEGORIES } from "@/features/brag/schema";

const fieldClass =
  "h-8 rounded-md border border-input bg-card px-2.5 text-[13px] shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/**
 * Timeline filters — category, tag, and date range. URL-driven (each change
 * pushes the updated query string), so the server re-renders the filtered
 * timeline and the bar reflects the active filters. Tags come from the document.
 */
export function FilterBar({ tags }: { tags: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const category = sp.get("category") ?? "";
  const tag = sp.get("tag") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const active = Boolean(category || tag || from || to);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={category}
        onChange={(e) => setParam("category", e.target.value)}
        aria-label="Filter by category"
        className={fieldClass}
      >
        <option value="">All categories</option>
        {BRAG_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      {tags.length > 0 ? (
        <select
          value={tag}
          onChange={(e) => setParam("tag", e.target.value)}
          aria-label="Filter by tag"
          className={fieldClass}
        >
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </select>
      ) : null}

      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => setParam("from", e.target.value)}
          aria-label="From date"
          className={fieldClass}
        />
        <span className="text-ink-faint">→</span>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => setParam("to", e.target.value)}
          aria-label="To date"
          className={fieldClass}
        />
      </div>

      {active ? (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="font-mono text-[11px] text-ink-faint underline-offset-2 hover:text-ink hover:underline"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}

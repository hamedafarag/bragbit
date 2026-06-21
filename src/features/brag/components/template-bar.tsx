"use client";

import { cn } from "@/lib/utils";

import { BRAG_CATEGORIES } from "../schema";
import { BRAG_TEMPLATES, templateToInitial } from "../templates";
import { BragEditor } from "./brag-editor";

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const CATEGORY_DOT = new Map(BRAG_CATEGORIES.map((c) => [c.value, c.dot]));

/**
 * A row of action-verb template chips beneath the quick-add box (ENH-UX-04).
 * Each chip opens the full editor pre-filled from a template — the same path
 * edit mode uses (the dialog reads `initial` when it opens) — to beat the blank
 * page. The dot mirrors the category's logbook color so the taxonomy reads at a
 * glance. The chips themselves carry no date, so there's no SSR/client skew.
 */
export function TemplateBar({ documentId }: { documentId: string }) {
  const today = todayLocal();
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase">
        Start from
      </span>
      {BRAG_TEMPLATES.map((t) => (
        <BragEditor
          key={t.id}
          documentId={documentId}
          initial={templateToInitial(t, today)}
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-1 text-[12px] text-ink-soft shadow-sm transition-colors hover:border-primary hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className={cn("size-1.5 rounded-full", CATEGORY_DOT.get(t.category))} />
              {t.label}
            </button>
          }
        />
      ))}
    </div>
  );
}

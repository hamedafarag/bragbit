"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { quickAddBrag } from "../actions";
import { BragEditor } from "./brag-editor";

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Quick-add — the product's soul. Type a title, press Enter (or N to focus from
 * anywhere), and a brag is logged with today's date; everything else can wait.
 * "Add with details" opens the full editor for when you want it up front.
 */
export function QuickAdd({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // `n` focuses the capture box from anywhere (unless you're already typing).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function submit() {
    const input = inputRef.current;
    const title = input?.value.trim() ?? "";
    if (!title) {
      input?.focus();
      return;
    }
    start(async () => {
      const result = await quickAddBrag(documentId, { title, date: todayLocal() });
      if (result.ok) {
        toast.success("Win logged.");
        if (input) input.value = "";
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 shadow-card focus-within:border-primary"
      >
        <div className="grid size-[26px] place-items-center rounded-md bg-primary/10 text-[17px] font-semibold text-primary">
          +
        </div>
        <input
          ref={inputRef}
          name="title"
          maxLength={300}
          className="min-w-0 flex-1 border-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
          placeholder="Log a win — only a title is required, everything else can wait…"
        />
        <kbd className="hidden rounded border border-b-2 border-line bg-card px-1.5 py-px font-mono text-[10.5px] text-ink-soft sm:inline">
          N
        </kbd>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </Button>
      </form>

      <div className="mx-1 mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] text-ink-faint">
          FORMULA · <span className="text-primary">what you did</span> +{" "}
          <span className="text-primary">why it mattered</span> +{" "}
          <span className="text-primary">the measurable result</span>
        </p>
        <BragEditor
          documentId={documentId}
          trigger={
            <button
              type="button"
              className="font-mono text-[10.5px] text-ink-faint underline-offset-2 hover:text-ink hover:underline"
            >
              Add with details →
            </button>
          }
        />
      </div>
    </div>
  );
}

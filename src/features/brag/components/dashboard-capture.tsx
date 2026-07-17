"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { quickAddBrag } from "../actions";
import { BragEditor } from "./brag-editor";

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Dashboard quick-capture — the in-document quick-add (the product's soul) hoisted
 * to the home screen, so a win can be logged without first opening a document.
 * Targets the most-recent document by default (the same default the MCP connector
 * uses), shown as "Lands in …" with a selector once the user keeps several. Only
 * rendered when a document exists; before that the dashboard's "start your first
 * document" empty state owns the space.
 */
export function DashboardCapture({ documents }: { documents: { id: string; title: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const [docId, setDocId] = useState(documents[0]!.id);

  // `n` focuses the capture box from anywhere (unless you're already typing) — the
  // same shortcut the in-document quick-add binds, now working on the dashboard too.
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
      const result = await quickAddBrag(docId, { title, date: todayLocal() });
      if (result.ok) {
        toast.success("Win logged.");
        if (input) input.value = "";
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const target = documents.find((d) => d.id === docId) ?? documents[0]!;

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

      <div className="mx-1 mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-faint">
        <span className="flex items-center gap-1.5">
          Lands in
          {documents.length > 1 ? (
            <select
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
              className="max-w-[200px] cursor-pointer truncate rounded bg-transparent font-medium text-ink-soft outline-none hover:text-ink focus:text-ink"
              aria-label="Which document this win lands in"
            >
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          ) : (
            <span className="font-medium text-ink-soft">{target.title}</span>
          )}
        </span>
        <BragEditor
          documentId={docId}
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

"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Lazy-load the renderer so react-markdown only ships once a preview is opened.
const MarkdownPreview = dynamic(
  () => import("@/components/shared/markdown").then((m) => ({ default: m.Markdown })),
  { ssr: false, loading: () => <p className="text-[13px] text-ink-faint">Loading preview…</p> },
);

/**
 * A Markdown textarea with a Write/Preview toggle. The textarea stays mounted
 * (hidden, not unmounted) in preview mode so its value is still in the form's
 * FormData on submit; the preview renders the current value through the shared,
 * sanitized Markdown component.
 */
export function MarkdownField({
  id,
  name,
  defaultValue = "",
  placeholder,
  rows = 4,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [value, setValue] = useState(defaultValue);

  return (
    <div>
      <div className="mb-1.5 flex gap-1">
        <ModeTab active={tab === "write"} onClick={() => setTab("write")}>
          Write
        </ModeTab>
        <ModeTab active={tab === "preview"} onClick={() => setTab("preview")}>
          Preview
        </ModeTab>
      </div>
      <Textarea
        id={id}
        name={name}
        rows={rows}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className={cn("font-mono text-[13px]", tab === "preview" && "hidden")}
      />
      {tab === "preview" ? (
        <div className="min-h-16 rounded-md border border-input bg-card px-3 py-2">
          {value.trim() ? (
            <MarkdownPreview>{value}</MarkdownPreview>
          ) : (
            <p className="text-[13px] text-ink-faint">Nothing to preview yet.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 font-mono text-[10.5px] tracking-[0.08em] uppercase",
        active ? "bg-ink text-paper" : "text-ink-faint hover:text-ink-soft",
      )}
    >
      {children}
    </button>
  );
}

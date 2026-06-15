"use client";

import { ExternalLink, Paperclip } from "lucide-react";
import { useState } from "react";

import { Markdown } from "@/components/shared/markdown";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatBytes } from "@/features/attachment/components/attachment-manager";

import { BRAG_CATEGORIES } from "../schema";

export type BragDetailData = {
  title: string;
  date: string; // YYYY-MM-DD
  category: string | null;
  status: string | null;
  descriptionMd: string | null;
  impactMd: string | null;
  collaborators: string[];
  attribution: string | null;
  tags: string[];
  links: { url: string; label: string | null }[];
  attachments: { id: string; fileName: string; mimeType: string; sizeBytes: number; url: string }[];
};

function sectionLabel(text: string) {
  return (
    <div className="mb-1.5 font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase">
      {text}
    </div>
  );
}

/**
 * Full read view of a brag, opened from the timeline card's title. The timeline
 * keeps attachments as dense chips; here they expand to inline image previews +
 * sizes (per the design — previews live in the detail, not the timeline).
 */
export function BragDetail({ data }: { data: BragDetailData }) {
  const [open, setOpen] = useState(false);
  const cat = BRAG_CATEGORIES.find((c) => c.value === data.category) ?? null;
  const when = new Date(`${data.date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-left font-serif text-[18px] leading-snug font-semibold tracking-[-0.01em] text-ink decoration-line underline-offset-4 hover:underline"
        >
          {data.title}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] tracking-[0.1em] text-ink-faint uppercase">
              {when}
            </span>
            {cat ? (
              <Badge variant="outline">
                <span className={`size-1.5 rounded-full ${cat.dot}`} />
                {cat.label}
              </Badge>
            ) : null}
            {data.status === "in_progress" ? <Badge variant="outline">In progress</Badge> : null}
          </div>
          <DialogTitle className="font-serif text-[22px] leading-tight font-semibold tracking-[-0.01em]">
            {data.title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {data.descriptionMd ? <Markdown>{data.descriptionMd}</Markdown> : null}

          {data.impactMd ? (
            <div className="flex w-fit items-baseline gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-[13px] font-medium text-primary">
              <span aria-hidden>↗</span>
              <Markdown className="text-primary [&_p]:m-0">{data.impactMd}</Markdown>
            </div>
          ) : null}

          {data.attachments.length > 0 ? (
            <section>
              {sectionLabel("Attachments")}
              <ul className="flex flex-col gap-2">
                {data.attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 rounded-md border border-line-soft bg-paper px-3 py-2"
                  >
                    {a.mimeType.startsWith("image/") ? (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                      >
                        {/* Authorizing same-origin route, not an optimizable static asset. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={a.url}
                          alt={a.fileName}
                          className="size-14 rounded object-cover"
                        />
                      </a>
                    ) : (
                      <span className="grid size-14 shrink-0 place-items-center rounded bg-paper-deep text-ink-faint">
                        <Paperclip className="size-5" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-[13.5px] text-ink no-underline hover:underline"
                      >
                        {a.fileName}
                      </a>
                      <div className="font-mono text-[10.5px] text-ink-faint">
                        {formatBytes(a.sizeBytes)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.links.length > 0 ? (
            <section>
              {sectionLabel("Links")}
              <ul className="flex flex-col gap-1.5">
                {data.links.map((l, i) => (
                  <li key={i}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1.5 text-[13.5px] text-primary"
                    >
                      <ExternalLink className="size-3.5 shrink-0" />
                      <span className="truncate">{l.label || l.url}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.collaborators.length > 0 || data.attribution || data.tags.length > 0 ? (
            <div className="flex flex-col gap-1.5 border-t border-dashed border-line-soft pt-3 font-mono text-[11px] text-ink-faint">
              {data.collaborators.length > 0 ? (
                <span>w/ {data.collaborators.join(", ")}</span>
              ) : null}
              {data.attribution ? <span>— {data.attribution}</span> : null}
              {data.tags.length > 0 ? (
                <span className="flex flex-wrap gap-x-2 gap-y-1">
                  {data.tags.map((t) => (
                    <span key={t} className="before:opacity-60 before:content-['#']">
                      {t}
                    </span>
                  ))}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

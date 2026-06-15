import { ExternalLink, Paperclip } from "lucide-react";
import type { ReactNode } from "react";

import { Markdown } from "@/components/shared/markdown";
import { Badge } from "@/components/ui/badge";

import type { BragWithRelations } from "../queries";
import { BRAG_CATEGORIES } from "../schema";

function categoryMeta(value: string | null) {
  return BRAG_CATEGORIES.find((c) => c.value === value) ?? null;
}

/** Strip the scheme + trailing slash for a tidy chip when a link has no label. */
function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/**
 * The server-rendered visual shell of a timeline brag card — spine node, date,
 * category/status/private badges, title slot, Markdown description + impact, link
 * and attachment chips, and the tags/collaborators footer. It imports no client
 * components, so both the owner card (BragCard, which injects the interactive
 * title + Edit/Delete slots) and the public share card (PublicBragCard, plain
 * title, read-only) reuse it without dragging the editor into the public bundle.
 *
 * `title` fills the `<h3>`; `actions` (optional) sits top-right; with `shareToken`
 * the attachment chips carry the token so the file route authorizes them by share
 * rather than session.
 */
export function BragCardShell({
  brag,
  title,
  actions,
  shareToken,
}: {
  brag: BragWithRelations;
  title: ReactNode;
  actions?: ReactNode;
  shareToken?: string;
}) {
  const cat = categoryMeta(brag.category);
  const d = new Date(`${brag.date}T00:00:00`);
  const mon = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const dow = d.toLocaleDateString("en-US", { weekday: "short" });
  const isPrivate = brag.visibility === "private";
  const collaborators = brag.collaborators ?? [];
  const fileHref = (storageKey: string) =>
    shareToken ? `/api/files/${storageKey}?token=${shareToken}` : `/api/files/${storageKey}`;

  return (
    <li id={brag.id} className="relative grid scroll-mt-24 grid-cols-[60px_1fr] gap-x-8 py-1">
      {/* Status-only spine node: solid = shipped (or unset), hollow = in-progress. */}
      <span
        aria-hidden
        className={`absolute top-[22px] left-[72px] size-2 rounded-full border-2 border-primary ${
          brag.status === "in_progress" ? "bg-paper" : "bg-primary"
        }`}
      />
      <div className="pt-[18px] text-right font-mono text-[10.5px] font-medium tracking-[0.08em] text-ink-soft uppercase">
        {mon}
        <small className="block text-[9px] tracking-[0.14em] text-ink-faint">{dow}</small>
      </div>
      <div
        className={`min-w-0 rounded-xl border bg-card px-5 pt-3.5 pb-3.5 shadow-card transition-shadow hover:shadow-card-hover ${
          isPrivate
            ? "border-dashed border-line bg-[repeating-linear-gradient(45deg,transparent_0_9px,rgba(34,29,22,0.018)_9px_10px)]"
            : "border-line"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-h-8 flex-wrap items-center gap-2">
            {cat ? (
              <Badge variant="outline">
                <span className={`size-1.5 rounded-full ${cat.dot}`} />
                {cat.label}
              </Badge>
            ) : null}
            {brag.status === "in_progress" ? <Badge variant="outline">In progress</Badge> : null}
            {isPrivate ? (
              <Badge variant="outline" className="border-dashed border-ink-faint">
                Private
              </Badge>
            ) : null}
          </div>
          {actions}
        </div>

        <h3 className="mt-1">{title}</h3>

        {brag.descriptionMd ? (
          <Markdown className="mt-1.5 max-w-[62ch]">{brag.descriptionMd}</Markdown>
        ) : null}

        {brag.impactMd ? (
          <div className="mt-2.5 flex w-fit items-baseline gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-[12.5px] font-medium text-primary">
            <span aria-hidden>↗</span>
            <Markdown className="text-primary [&_p]:m-0">{brag.impactMd}</Markdown>
          </div>
        ) : null}

        {brag.links.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {brag.links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-[260px] items-center gap-1.5 truncate rounded-md border border-line-soft bg-paper px-2 py-[3px] font-mono text-[10.5px] text-ink-soft no-underline hover:border-ink-faint hover:text-ink"
              >
                <ExternalLink className="size-3 shrink-0" />
                <span className="truncate">{link.label || prettyUrl(link.url)}</span>
              </a>
            ))}
          </div>
        ) : null}

        {brag.attachments.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {brag.attachments.map((att) => (
              <a
                key={att.id}
                href={fileHref(att.storageKey)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-[260px] items-center gap-1.5 rounded-md border border-line-soft bg-paper px-2 py-[3px] font-mono text-[10.5px] text-ink-soft no-underline hover:border-ink-faint hover:text-ink"
              >
                <Paperclip className="size-3 shrink-0" />
                <span className="truncate">{att.fileName}</span>
              </a>
            ))}
          </div>
        ) : null}

        {brag.tags.length > 0 || collaborators.length > 0 || brag.attribution ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-dashed border-line-soft pt-2.5 font-mono text-[10px] text-ink-faint">
            {brag.tags.length > 0 ? (
              <span className="flex flex-wrap gap-x-2 gap-y-1">
                {brag.tags.map((t) => (
                  <span key={t} className="before:opacity-60 before:content-['#']">
                    {t}
                  </span>
                ))}
              </span>
            ) : null}
            {collaborators.length > 0 ? <span>w/ {collaborators.join(", ")}</span> : null}
            {brag.attribution ? <span>— {brag.attribution}</span> : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

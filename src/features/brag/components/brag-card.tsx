import { Markdown } from "@/components/shared/markdown";
import { Badge } from "@/components/ui/badge";

import type { BragRow } from "../queries";
import { BRAG_CATEGORIES } from "../schema";
import { BragActions } from "./brag-actions";
import type { BragFormValues } from "./brag-editor";

function categoryMeta(value: string | null) {
  return BRAG_CATEGORIES.find((c) => c.value === value) ?? null;
}

/**
 * One brag in a document. Reverse-chron list rendering (the month-grouped
 * timeline with its spine is Phase 5). Markdown is rendered server-side here, so
 * brag descriptions add no client JS. The dashed/hatched private treatment is
 * wired on `visibility` for when the Phase 6 toggle lands; nothing sets it yet.
 */
export function BragCard({ brag }: { brag: BragRow }) {
  const cat = categoryMeta(brag.category);
  const d = new Date(`${brag.date}T00:00:00`);
  const mon = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const dow = d.toLocaleDateString("en-US", { weekday: "short" });
  const isPrivate = brag.visibility === "private";
  const collaborators = brag.collaborators ?? [];

  const initial: BragFormValues = {
    title: brag.title,
    date: brag.date,
    category: brag.category ?? "",
    status: brag.status ?? "",
    descriptionMd: brag.descriptionMd ?? "",
    impactMd: brag.impactMd ?? "",
    collaborators: collaborators.join(", "),
    attribution: brag.attribution ?? "",
  };

  return (
    <li className="grid grid-cols-[56px_1fr] gap-x-4 sm:grid-cols-[64px_1fr] sm:gap-x-5">
      <div className="pt-4 text-right font-mono text-[10.5px] font-medium tracking-[0.08em] text-ink-soft uppercase">
        {mon}
        <small className="block text-[9px] tracking-[0.14em] text-ink-faint">{dow}</small>
      </div>
      <div
        className={`rounded-xl border bg-card px-5 pt-3.5 pb-3.5 shadow-card transition-shadow hover:shadow-card-hover ${
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
          <BragActions
            bragId={brag.id}
            documentId={brag.documentId}
            title={brag.title}
            initial={initial}
          />
        </div>

        <h3 className="mt-1 font-serif text-[18px] leading-snug font-semibold tracking-[-0.01em]">
          {brag.title}
        </h3>

        {brag.descriptionMd ? (
          <Markdown className="mt-1.5 max-w-[62ch]">{brag.descriptionMd}</Markdown>
        ) : null}

        {brag.impactMd ? (
          <div className="mt-2.5 flex w-fit items-baseline gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-[12.5px] font-medium text-primary">
            <span aria-hidden>↗</span>
            <Markdown className="text-primary [&_p]:m-0">{brag.impactMd}</Markdown>
          </div>
        ) : null}

        {collaborators.length > 0 || brag.attribution ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-dashed border-line-soft pt-2.5 font-mono text-[10px] text-ink-faint">
            {collaborators.length > 0 ? <span>w/ {collaborators.join(", ")}</span> : null}
            {brag.attribution ? <span>— {brag.attribution}</span> : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

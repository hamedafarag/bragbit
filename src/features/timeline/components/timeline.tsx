import { Fragment, type ReactNode } from "react";

import type { BragWithRelations } from "@/features/brag/queries";

type MonthGroup = { key: string; label: string; year: string; brags: BragWithRelations[] };

/** Group date-desc brags into contiguous month buckets (newest month first). */
function groupByMonth(brags: BragWithRelations[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const brag of brags) {
    const key = brag.date.slice(0, 7); // "YYYY-MM"
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.brags.push(brag);
    } else {
      const label = new Date(`${key}-01T00:00:00`).toLocaleDateString("en-US", { month: "long" });
      groups.push({ key, label, year: key.slice(0, 4), brags: [brag] });
    }
  }
  return groups;
}

/** Months since year 0, so a gap between two month buckets is a simple subtraction. */
function monthIndex(key: string): number {
  const [year, month] = key.split("-").map(Number);
  return year! * 12 + month!;
}

/**
 * One contiguous slice of the timeline: date-desc brags grouped into month
 * sections (sticky headers + per-month win counts) along the shared spine. The
 * per-brag status node lives on the card (solid = shipped, hollow = in-progress);
 * private is a card treatment, not a node ring (PLAN §4).
 *
 * When `showGaps` (the unfiltered view), quiet months between entries are marked
 * so the logging cadence is visible — including a *leading* gap from `prevMonthKey`
 * (the month immediately newer than this slice). That's how cursor-paged "load
 * more" keeps the cadence correct across the page boundary: a slice's first month
 * measures its gap against the previous page's oldest month, not nothing. On the
 * first page `prevMonthKey` is null, so there's no leading marker.
 *
 * Card-agnostic: callers pass `renderCard` so the owner timeline injects the
 * interactive BragCard while the public share page injects a read-only card —
 * keeping the owner editor out of the public bundle. A shared component (no
 * server-only), so the "load more" island can render appended slices client-side
 * with the very same markup as the server-rendered first page.
 */
export function TimelineChunk({
  brags,
  showGaps = false,
  prevMonthKey = null,
  renderCard,
}: {
  brags: BragWithRelations[];
  showGaps?: boolean;
  prevMonthKey?: string | null;
  renderCard: (brag: BragWithRelations) => ReactNode;
}) {
  const months = groupByMonth(brags);

  return (
    <>
      {months.map((month, i) => {
        // Gap reference: the previous month in this slice, or — for the slice's
        // first month — the previous page's oldest month (prevMonthKey).
        const prevKey = i > 0 ? months[i - 1]!.key : prevMonthKey;
        const gap = showGaps && prevKey ? monthIndex(prevKey) - monthIndex(month.key) - 1 : 0;
        return (
          <Fragment key={month.key}>
            {gap > 0 ? (
              <div className="py-1.5 pl-[92px] font-mono text-[10px] text-ink-faint italic">
                · {gap} quiet {gap === 1 ? "month" : "months"} ·
              </div>
            ) : null}
            <section>
              <header className="sticky top-[60px] z-10 flex items-baseline gap-3 bg-[linear-gradient(to_bottom,var(--color-paper)_72%,transparent)] py-3">
                <h2 className="font-serif text-[20px] leading-none font-medium italic">
                  {month.label}
                </h2>
                <span className="font-mono text-[10px] tracking-[0.12em] text-ink-faint uppercase">
                  {month.year} — {month.brags.length} {month.brags.length === 1 ? "win" : "wins"}
                </span>
                <span className="h-px flex-1 bg-line-soft" />
              </header>
              <ul className="flex flex-col gap-3 pb-2">
                {month.brags.map((brag) => (
                  <Fragment key={brag.id}>{renderCard(brag)}</Fragment>
                ))}
              </ul>
            </section>
          </Fragment>
        );
      })}
    </>
  );
}

/**
 * The document timeline, all brags in one pass: the `.relative` wrapper + vertical
 * spine around a single {@link TimelineChunk}. Used where the whole set renders at
 * once (the public share page). The owner timeline paginates instead — see
 * LoadMoreTimeline, which owns its own wrapper + spine so the spine grows as older
 * pages append. Brags arrive already date-desc from the query layer.
 */
export function Timeline({
  brags,
  showGaps = false,
  renderCard,
}: {
  brags: BragWithRelations[];
  showGaps?: boolean;
  renderCard: (brag: BragWithRelations) => ReactNode;
}) {
  return (
    <div className="relative">
      {/* The spine — behind the entries; sticky month headers fade it with their gradient. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-[76px] w-px bg-line"
      />
      <TimelineChunk
        brags={brags}
        showGaps={showGaps}
        prevMonthKey={null}
        renderCard={renderCard}
      />
    </div>
  );
}

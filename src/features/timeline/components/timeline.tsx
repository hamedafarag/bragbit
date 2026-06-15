import { BragCard } from "@/features/brag/components/brag-card";
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

/**
 * The document timeline: brags reverse-chronological, grouped by month with
 * sticky month headers and a vertical spine. The per-brag status node lives on
 * BragCard (solid = shipped, hollow = in-progress); private is a card treatment,
 * not a node ring (PLAN §4). Brags arrive already date-desc from listBrags. The
 * month-windowed cursor pagination for very long documents is Phase 5 slice 3.
 */
export function Timeline({ brags }: { brags: BragWithRelations[] }) {
  const months = groupByMonth(brags);

  return (
    <div className="relative">
      {/* The spine — behind the entries; sticky month headers fade it with their gradient. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-[76px] w-px bg-line"
      />
      {months.map((month) => (
        <section key={month.key}>
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
              <BragCard key={brag.id} brag={brag} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

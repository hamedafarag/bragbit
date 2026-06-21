import { cn } from "@/lib/utils";

import type { ActivityData, ActivityDay } from "../activity";

const PITCH = 14; // px per week column: an 11px cell + a 3px gap (gap-[3px], size-[11px]).

const LEVEL_CLASS = [
  "bg-paper-deep",
  "bg-primary/25",
  "bg-primary/50",
  "bg-primary/75",
  "bg-primary",
] as const;

const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

function describeDay(day: ActivityDay): string {
  const when = fmt.format(new Date(`${day.date}T00:00:00`));
  if (day.count === 0) return `No wins on ${when}`;
  return `${day.count} ${day.count === 1 ? "win" : "wins"} on ${when}`;
}

/**
 * The dashboard activity heatmap + streak (ENH-UX-05). Presentational and
 * server-rendered (no client JS) — it paints a prebuilt `ActivityData`. Cells are
 * tinted in the workspace accent (`--primary`); the whole grid is one
 * `role="img"` with a text summary so a screen reader gets the gist instead of
 * 364 cells.
 */
export function ActivityHeatmap({ data }: { data: ActivityData }) {
  const summary =
    `Win activity, last 12 months: ${data.totalWins} ${data.totalWins === 1 ? "win" : "wins"}, ` +
    `current streak ${data.currentStreak} ${data.currentStreak === 1 ? "week" : "weeks"}.`;

  return (
    <section className="rounded-xl border border-line bg-card p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-mono text-[10px] tracking-[0.16em] text-ink-faint uppercase">
          Activity
        </h2>
        <div className="flex items-center gap-4 text-[12px] text-ink-soft">
          <span>
            <b className="font-medium text-ink">{data.currentStreak}</b>-week streak
          </span>
          <span>
            <b className="font-medium text-ink">{data.totalWins}</b>{" "}
            {data.totalWins === 1 ? "win" : "wins"} this year
          </span>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div style={{ width: data.weekCount * PITCH }}>
          {/* Month labels sit over the column where each month begins. */}
          <div className="relative mb-1 h-3">
            {data.monthLabels.map((m) => (
              <span
                key={m.weekIndex}
                className="absolute font-mono text-[9px] text-ink-faint"
                style={{ left: m.weekIndex * PITCH }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div role="img" aria-label={summary} className="flex gap-[3px]">
            {data.weeks.map((col, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {col.map((day) => (
                  <div
                    key={day.date}
                    title={day.inWindow ? describeDay(day) : undefined}
                    aria-hidden
                    className={cn(
                      "size-[11px] rounded-[2px]",
                      day.inWindow ? LEVEL_CLASS[day.level] : "opacity-0",
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1 font-mono text-[10px] text-ink-faint">
        <span>Less</span>
        {LEVEL_CLASS.map((c, i) => (
          <span key={i} aria-hidden className={cn("size-[11px] rounded-[2px]", c)} />
        ))}
        <span>More</span>
      </div>
    </section>
  );
}

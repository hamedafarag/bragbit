import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isInstanceSetup } from "@/features/setup/queries";
import { isPrivate } from "@/lib/instance";

// Phase 0 baseline — the "engineering logbook" component language rendered with
// the reconciled shadcn + logbook tokens (brand accent = shadcn `--primary`).
// The real timeline lands in Phase 5; this page verifies tokens + primitives.

const stats: [string, string][] = [
  ["24", "wins"],
  ["9", "shipped"],
  ["4", "recognitions"],
  ["12", "attachments"],
  ["1", "private"],
];

const filters: [string, string | null, boolean][] = [
  ["All · 24", null, true],
  ["Shipped · 9", "bg-cat-shipped", false],
  ["Technical · 6", "bg-cat-technical", false],
  ["Collaboration · 3", "bg-cat-collaboration", false],
  ["Recognition · 4", "bg-cat-recognition", false],
  ["Glue work · 2", "bg-cat-glue", false],
];

export default async function Home() {
  // First-run (private modes): no workspace yet → send the operator to /setup.
  if (isPrivate() && !(await isInstanceSetup())) redirect("/setup");

  return (
    <div className="relative z-10">
      <header className="sticky top-0 z-50 flex h-[60px] items-center gap-4 border-b border-line bg-paper/85 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary font-serif text-[17px] font-semibold text-primary-foreground shadow-[inset_0_-8px_14px_rgba(0,0,0,0.18)]">
            B
          </div>
          <div>
            <div className="font-serif text-[17.5px] leading-none font-semibold">BragBit</div>
            <div className="mt-0.5 font-mono text-[9.5px] tracking-[0.14em] text-ink-faint uppercase">
              Engineering Logbook
            </div>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-[13px] text-ink-faint">
          <SearchIcon />
          Search all documents
          <kbd className="rounded border border-b-2 border-line bg-card px-1.5 py-px font-mono text-[10.5px] text-ink-soft">
            ⌘K
          </kbd>
        </div>
        <Link
          href="/profile"
          aria-label="Your profile"
          className="grid h-[30px] w-[30px] place-items-center rounded-full border border-line bg-paper-deep font-mono text-[11px] font-medium text-ink-soft no-underline hover:border-ink-faint hover:text-ink"
        >
          HF
        </Link>
      </header>

      <main className="mx-auto max-w-[880px] px-10 pt-9 pb-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5 font-mono text-[10px] tracking-[0.16em] text-ink-faint uppercase">
              Review Period · Jan 01 — Dec 31
              <span className="h-px w-12 bg-line" />
            </div>
            <h1 className="mt-1.5 mb-0.5 font-serif text-[54px] leading-[1.05] font-medium tracking-[-0.015em]">
              2026
              <em className="ml-2.5 text-[0.55em] font-normal text-ink-soft italic">
                the year of shipping
              </em>
            </h1>
            <p className="mt-2 max-w-[520px] text-[13.5px] text-ink-soft">
              <b className="font-semibold text-ink">Goals &amp; focus areas:</b> Own realtime
              platform reliability · grow toward Staff scope · mentor two juniors to independence.
            </p>
            <div className="mt-3.5 flex flex-wrap gap-[18px] font-mono text-[11.5px] text-ink-soft">
              {stats.map(([n, l]) => (
                <span key={l} className="flex items-baseline gap-1.5">
                  <b className="font-medium text-ink">{n}</b> {l}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2.5">
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Export
              </Button>
              <Button size="sm">Share · read-only</Button>
            </div>
            <div className="font-mono text-[10.5px] text-ink-faint">
              1 active link · password on · viewed 3d ago
            </div>
          </div>
        </div>

        <div className="mt-[30px] flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-[13px] shadow-card focus-within:border-primary">
          <div className="grid h-[26px] w-[26px] place-items-center rounded-md bg-primary/10 text-[17px] font-semibold text-primary">
            +
          </div>
          <input
            className="flex-1 border-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            placeholder="Log a win — only a title is required, everything else can wait…"
          />
          <div className="flex items-center gap-2">
            <kbd className="rounded border border-b-2 border-line bg-card px-1.5 py-px font-mono text-[10.5px] text-ink-soft">
              N
            </kbd>
            <Button size="sm">Add</Button>
          </div>
        </div>
        <p className="mx-1 mt-2 font-mono text-[10px] text-ink-faint">
          FORMULA · <i className="text-primary not-italic">what you did</i> +{" "}
          <i className="text-primary not-italic">why it mattered</i> +{" "}
          <i className="text-primary not-italic">the measurable result</i>
        </p>

        <div className="mt-[26px] flex flex-wrap gap-2">
          {filters.map(([label, dot, on]) => (
            <button
              key={label}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-[5px] font-mono text-[11px] ${
                on ? "border-ink bg-ink text-paper" : "border-line bg-transparent text-ink-soft"
              }`}
            >
              {dot && <span className={`h-[7px] w-[7px] rounded-full ${dot}`} />}
              {label}
            </button>
          ))}
        </div>

        <div className="relative mt-[18px]">
          <div className="pointer-events-none absolute top-4 bottom-0 left-[92px] w-px bg-line" />

          <div className="sticky top-[60px] z-10 flex items-baseline gap-3.5 bg-[linear-gradient(to_bottom,var(--color-paper)_78%,transparent)] py-4">
            <div className="min-w-[78px] font-serif text-[21px] font-medium italic">June</div>
            <div className="font-mono text-[10px] tracking-[0.12em] text-ink-faint uppercase">
              2026 — 3 wins
            </div>
            <div className="h-px flex-1 bg-line-soft" />
          </div>

          <Entry date="Jun 12" dow="Fri">
            <div className="mb-[7px] flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                <span className="size-1.5 rounded-full bg-cat-shipped" />
                Shipped work
              </Badge>
            </div>
            <h3 className="mb-[5px] font-serif text-[18.5px] leading-snug font-semibold tracking-[-0.01em]">
              Shipped the real-time crew heatmap to production
            </h3>
            <p className="max-w-[60ch] text-[13.5px] text-ink-soft">
              Led rollout across 14 active sites. Re-worked stream ingestion with the data team so
              positions render in under a second.
            </p>
            <Impact>Site managers locate idle crews 4× faster — 22 min → 5 min avg</Impact>
            <Foot>
              <Chip icon={<LinkIcon />}>PR #1482</Chip>
              <Chip icon={<ClipIcon />}>heatmap-dashboard.png</Chip>
              <Tag>realtime</Tag>
              <Tag>platform</Tag>
              <span className="ml-auto font-mono text-[10px] text-ink-faint">
                w/ Data team, N. Osei
              </span>
            </Foot>
          </Entry>

          <Entry date="Jun 09" dow="Tue">
            <div className="mb-[7px] flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                <span className="size-1.5 rounded-full bg-cat-recognition" />
                Recognition
              </Badge>
            </div>
            <p className="relative max-w-[56ch] pl-6 font-serif text-[18px] leading-[1.5] italic">
              <span className="absolute -top-3.5 -left-1 font-serif text-[52px] text-primary not-italic opacity-55">
                &ldquo;
              </span>
              Hamed unblocked the entire firmware team during the gateway outage — calm, methodical,
              and unbelievably fast.
            </p>
            <p className="mt-2.5 font-mono text-[11px] text-ink-soft">
              — <b className="font-medium text-ink">Sara M.</b>, Director of Engineering · via Slack
            </p>
          </Entry>

          <Entry date="Jun 03" dow="Wed" privateCard>
            <div className="mb-[7px] flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                <span className="size-1.5 rounded-full bg-cat-technical" />
                Technical
              </Badge>
              <Badge variant="outline" className="border-dashed border-ink-faint bg-transparent">
                ⌀ Private — hidden from shared views
              </Badge>
            </div>
            <h3 className="mb-[5px] font-serif text-[18.5px] leading-snug font-semibold tracking-[-0.01em]">
              Cut CI pipeline from 31 min to 9 min
            </h3>
            <p className="max-w-[60ch] text-[13.5px] text-ink-soft">
              Profiled the test suite, parallelized integration jobs, moved image builds to a cached
              runner.
            </p>
            <Impact>3.4× faster CI · ≈40 engineer-hours/week recovered</Impact>
            <Foot>
              <Chip icon={<LinkIcon />}>PR #1431</Chip>
              <Tag>ci</Tag>
              <Tag>devex</Tag>
            </Foot>
          </Entry>
        </div>
      </main>
    </div>
  );
}

/* ── building blocks ─────────────────────────────────────────────────────── */

function Entry({
  date,
  dow,
  privateCard,
  children,
}: {
  date: string;
  dow: string;
  privateCard?: boolean;
  children: React.ReactNode;
}) {
  return (
    <article className="relative grid grid-cols-[66px_1fr] gap-x-10 py-[7px]">
      {/* spine node — STATUS only (solid = shipped); visibility lives on the card */}
      <span className="absolute top-[26px] left-[88.5px] h-2 w-2 rounded-full border-2 border-primary bg-primary" />
      <div className="pt-[22px] text-right font-mono text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
        {date}
        <small className="block text-[9px] tracking-[0.14em] text-ink-faint">{dow}</small>
      </div>
      <div
        className={`rounded-xl border bg-card px-5 pt-[17px] pb-[15px] shadow-card transition-shadow hover:shadow-card-hover ${
          privateCard
            ? "border-dashed border-line bg-[repeating-linear-gradient(45deg,transparent_0_9px,rgba(34,29,22,0.018)_9px_10px)]"
            : "border-line"
        }`}
      >
        {children}
      </div>
    </article>
  );
}

function Impact({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-[11px] flex w-fit items-baseline gap-2 rounded-md bg-primary/10 px-3 py-2 font-mono text-[12.5px] font-medium text-primary">
      <span>↗</span>
      {children}
    </div>
  );
}

function Foot({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-[13px] flex flex-wrap items-center gap-2 border-t border-dashed border-line-soft pt-3">
      {children}
    </div>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <a
      href="#"
      className="inline-flex items-center gap-1.5 rounded-md border border-line-soft bg-paper px-2 py-[3px] font-mono text-[10.5px] text-ink-soft no-underline transition-colors hover:border-ink-faint hover:text-ink"
    >
      {icon}
      {children}
    </a>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10.5px] text-ink-faint before:opacity-60 before:content-['#']">
      {children}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} className="h-3.5 w-3.5 stroke-current">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} className="h-3 w-3 stroke-current">
      <path d="M10 14 21 3m0 0h-6m6 0v6M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

function ClipIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} className="h-3 w-3 stroke-current">
      <path d="m21.4 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.2-9.19a4 4 0 0 1 5.65 5.66L9.4 17.4a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

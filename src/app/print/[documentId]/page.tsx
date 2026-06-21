import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Markdown } from "@/components/shared/markdown";
import type { BragWithRelations } from "@/features/brag/queries";
import { BRAG_CATEGORIES } from "@/features/brag/schema";
import { PrintButton } from "@/features/export/components/print-button";
import { getDocumentForExport } from "@/features/export/queries";
import { getActiveWorkspace } from "@/features/workspace/queries";
import { accentVars } from "@/lib/utils";

// A print view is reached intentionally; no reason to index it.
export const metadata: Metadata = { title: "Print", robots: { index: false, follow: false } };

const STATUS_LABEL: Record<string, string> = { shipped: "Shipped", in_progress: "In progress" };
const longDate: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };

function fmtDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", longDate);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

type MonthGroup = { key: string; label: string; brags: BragWithRelations[] };

function groupByMonth(brags: BragWithRelations[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const brag of brags) {
    const key = brag.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.brags.push(brag);
    else
      groups.push({
        key,
        label: new Date(`${key}-01T00:00:00`).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
        brags: [brag],
      });
  }
  return groups;
}

function BragBlock({ brag }: { brag: BragWithRelations }) {
  const cat = BRAG_CATEGORIES.find((c) => c.value === brag.category) ?? null;
  const meta = [fmtDate(brag.date)];
  if (cat) meta.push(cat.label);
  if (brag.status && STATUS_LABEL[brag.status]) meta.push(STATUS_LABEL[brag.status]!);
  const collaborators = brag.collaborators ?? [];

  return (
    <article className="break-inside-avoid border-b border-line-soft py-4 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-serif text-[17px] leading-snug font-semibold">{brag.title}</h3>
        {brag.visibility === "private" ? (
          <span className="shrink-0 font-mono text-[9px] tracking-[0.14em] text-ink-faint uppercase">
            Private
          </span>
        ) : null}
      </div>
      <div className="mt-0.5 font-mono text-[10.5px] tracking-[0.04em] text-ink-faint">
        {meta.join(" · ")}
      </div>

      {brag.impactMd ? (
        <div className="mt-2 flex w-fit items-baseline gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-[12.5px] font-medium text-primary">
          <span aria-hidden>↗</span>
          <Markdown className="text-primary [&_p]:m-0">{brag.impactMd}</Markdown>
        </div>
      ) : null}
      {brag.descriptionMd ? (
        <Markdown className="mt-2 max-w-[68ch] text-[13px]">{brag.descriptionMd}</Markdown>
      ) : null}

      {brag.links.length > 0 ? (
        <p className="mt-2 text-[11.5px] text-ink-soft">
          <span className="font-medium">Links:</span>{" "}
          {brag.links.map((l, i) => (
            <span key={l.id}>
              {i > 0 ? ", " : ""}
              <a href={l.url} className="text-primary underline">
                {l.label || l.url}
              </a>
            </span>
          ))}
        </p>
      ) : null}
      {brag.attachments.length > 0 ? (
        <p className="mt-1 text-[11.5px] text-ink-soft">
          <span className="font-medium">Attachments:</span>{" "}
          {brag.attachments.map((a) => `${a.fileName} (${formatBytes(a.sizeBytes)})`).join(", ")}
        </p>
      ) : null}
      {collaborators.length > 0 || brag.attribution || brag.tags.length > 0 ? (
        <p className="mt-1 font-mono text-[10.5px] text-ink-faint">
          {collaborators.length > 0 ? `w/ ${collaborators.join(", ")}` : null}
          {brag.attribution ? `${collaborators.length > 0 ? " — " : ""}${brag.attribution}` : null}
          {brag.tags.length > 0 ? `  ${brag.tags.map((t) => `#${t}`).join(" ")}` : null}
        </p>
      ) : null}
    </article>
  );
}

/**
 * A print-optimized, branded view of a document the caller owns → the browser's
 * "Save as PDF" path (PLAN §7; the headless-Chromium service is deferred, browser
 * print is the v1 PDF route). Standalone (outside the `(app)` chrome), gated by
 * requireWorkspace through getActiveWorkspace. `?private=1` includes private brags
 * (marked, so an owner doesn't share them unawares); default off. Each month
 * starts on a fresh page in print. Next 16: params + searchParams are async.
 */
export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ private?: string }>;
}) {
  const { documentId } = await params;
  const includePrivate = (await searchParams).private === "1";
  const { user, workspace } = await getActiveWorkspace();
  const doc = await getDocumentForExport(
    documentId,
    { workspaceId: workspace.id, userId: user.id },
    includePrivate,
  );
  if (!doc) notFound();

  const months = groupByMonth(doc.brags);
  const period =
    doc.periodStart && doc.periodEnd
      ? `${fmtDate(doc.periodStart)} — ${fmtDate(doc.periodEnd)}`
      : (doc.periodStart ?? doc.periodEnd ?? null);
  const logoUrl = workspace.logoKey ? `/api/files/${workspace.logoKey}` : null;

  return (
    <div
      className="mx-auto max-w-[760px] px-8 py-10 print:px-0"
      style={accentVars(workspace.accentColor)}
    >
      <div className="mb-6 flex items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-2.5">
          {logoUrl ? (
            // Plain <img>: next/image optimization needs sharp (ENH-PERF-02); avatars/attachments are also session-gated.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={workspace.name}
              className="h-6 w-auto max-w-[120px] object-contain"
            />
          ) : null}
          <span className="font-serif text-[13px] font-semibold">{workspace.name}</span>
        </div>
        <PrintButton />
      </div>

      <header className="mb-6">
        {period ? (
          <div className="font-mono text-[10px] tracking-[0.16em] text-ink-faint uppercase">
            {period}
          </div>
        ) : null}
        <h1 className="font-serif text-[34px] leading-[1.05] font-medium tracking-[-0.015em]">
          {doc.title}
        </h1>
        {doc.description ? (
          <p className="mt-1.5 max-w-[62ch] text-[13.5px] text-ink-soft">{doc.description}</p>
        ) : null}
        {doc.goalsMd ? (
          <div className="mt-3 max-w-[64ch]">
            <div className="mb-1 font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase">
              Goals &amp; focus areas
            </div>
            <Markdown className="text-[13px]">{doc.goalsMd}</Markdown>
          </div>
        ) : null}
      </header>

      {months.length === 0 ? (
        <p className="text-[13px] text-ink-soft">No wins to show.</p>
      ) : (
        months.map((month, i) => (
          <section key={month.key} style={i > 0 ? { breakBefore: "page" } : undefined}>
            <h2 className="mt-4 mb-1 font-serif text-[19px] font-medium italic">{month.label}</h2>
            {month.brags.map((brag) => (
              <BragBlock key={brag.id} brag={brag} />
            ))}
          </section>
        ))
      )}

      <footer className="mt-8 border-t border-line pt-4 font-mono text-[10px] text-ink-faint">
        {doc.title} · {doc.brags.length} {doc.brags.length === 1 ? "win" : "wins"} · exported from{" "}
        {workspace.name} on BragBit
      </footer>
    </div>
  );
}

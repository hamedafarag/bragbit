import Link from "next/link";
import { notFound } from "next/navigation";

import { Markdown } from "@/components/shared/markdown";
import { Button } from "@/components/ui/button";
import { QuickAdd } from "@/features/brag/components/quick-add";
import { listBrags } from "@/features/brag/queries";
import { Timeline } from "@/features/timeline/components/timeline";
import {
  DocumentDialog,
  type DocumentFormValues,
} from "@/features/document/components/document-dialog";
import { getDocument } from "@/features/document/queries";

const dateFmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };

function formatPeriod(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString("en-US", dateFmt);
  if (start && end) return `${fmt(start)} — ${fmt(end)}`;
  return start ? `From ${fmt(start)}` : `Until ${fmt(end!)}`;
}

// A document and its brags. getDocument runs the DAL guard and scopes to the
// caller; an id they don't own (or that doesn't exist) 404s. Next 16: params is async.
export default async function DocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  const doc = await getDocument(documentId);
  if (!doc) notFound();

  const brags = await listBrags(documentId);
  const period = formatPeriod(doc.periodStart, doc.periodEnd);
  const editValues: DocumentFormValues = {
    title: doc.title,
    description: doc.description ?? "",
    periodStart: doc.periodStart ?? "",
    periodEnd: doc.periodEnd ?? "",
    goalsMd: doc.goalsMd ?? "",
  };

  return (
    <div className="flex flex-col gap-7">
      <Link
        href="/dashboard"
        className="font-mono text-[11px] text-ink-faint no-underline hover:text-ink-soft"
      >
        ← All documents
      </Link>

      <header className="flex flex-col gap-3">
        {period ? (
          <div className="font-mono text-[10px] tracking-[0.16em] text-ink-faint uppercase">
            {period}
          </div>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-serif text-[40px] leading-[1.05] font-medium tracking-[-0.015em]">
            {doc.title}
          </h1>
          <DocumentDialog
            documentId={doc.id}
            initial={editValues}
            trigger={
              <Button type="button" variant="outline" size="sm">
                Edit document
              </Button>
            }
          />
        </div>
        {doc.description ? (
          <p className="max-w-[60ch] text-[14px] text-ink-soft">{doc.description}</p>
        ) : null}
        {doc.goalsMd ? (
          <div className="max-w-[62ch]">
            <div className="mb-1 font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase">
              Goals &amp; focus areas
            </div>
            <Markdown>{doc.goalsMd}</Markdown>
          </div>
        ) : null}
        <div className="font-mono text-[11.5px] text-ink-soft">
          <b className="font-medium text-ink">{brags.length}</b>{" "}
          {brags.length === 1 ? "win" : "wins"}
        </div>
      </header>

      <QuickAdd documentId={doc.id} />

      {brags.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-card/60 px-6 py-12 text-center shadow-card">
          <h2 className="font-serif text-[18px] font-semibold">No wins logged yet</h2>
          <p className="mx-auto mt-1.5 max-w-[48ch] text-[13.5px] text-ink-soft">
            Start by back-filling three wins from the past month — a feature you shipped, a fire you
            put out, a teammate you unblocked. Just a title to start; press{" "}
            <kbd className="rounded border border-line bg-card px-1 font-mono text-[10px]">N</kbd>{" "}
            anytime.
          </p>
        </div>
      ) : (
        <Timeline brags={brags} />
      )}
    </div>
  );
}

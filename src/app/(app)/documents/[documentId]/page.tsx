import Link from "next/link";
import { notFound } from "next/navigation";

import { Markdown } from "@/components/shared/markdown";
import { Button } from "@/components/ui/button";
import { QuickAdd } from "@/features/brag/components/quick-add";
import {
  countDocumentBrags,
  listBrags,
  listDocumentTags,
  type BragFilters,
} from "@/features/brag/queries";
import { BRAG_CATEGORY_VALUES } from "@/features/brag/schema";
import {
  DocumentDialog,
  type DocumentFormValues,
} from "@/features/document/components/document-dialog";
import { BragCard } from "@/features/brag/components/brag-card";
import { getDocument } from "@/features/document/queries";
import { ExportDialog } from "@/features/export/components/export-dialog";
import { ShareDialog } from "@/features/share/components/share-dialog";
import { getActiveShareLink } from "@/features/share/queries";
import { FilterBar } from "@/features/timeline/components/filter-bar";
import { Timeline } from "@/features/timeline/components/timeline";

const dateFmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
const datePat = /^\d{4}-\d{2}-\d{2}$/;

function formatPeriod(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString("en-US", dateFmt);
  if (start && end) return `${fmt(start)} — ${fmt(end)}`;
  return start ? `From ${fmt(start)}` : `Until ${fmt(end!)}`;
}

type RawParams = { category?: string; tag?: string; from?: string; to?: string };

/** Validate URL params into filters; anything malformed is dropped. */
function parseFilters(sp: RawParams): BragFilters {
  const categoryOk =
    sp.category && (BRAG_CATEGORY_VALUES as readonly string[]).includes(sp.category);
  return {
    category: categoryOk ? sp.category : undefined,
    tag: sp.tag?.trim() || undefined,
    from: sp.from && datePat.test(sp.from) ? sp.from : undefined,
    to: sp.to && datePat.test(sp.to) ? sp.to : undefined,
  };
}

// A document and its (optionally filtered) brags. getDocument runs the DAL guard
// and scopes to the caller; an unowned/missing id 404s. Next 16: params + searchParams are async.
export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<RawParams>;
}) {
  const { documentId } = await params;
  const doc = await getDocument(documentId);
  if (!doc) notFound();

  const filters = parseFilters(await searchParams);
  const filtersActive = Boolean(filters.category || filters.tag || filters.from || filters.to);

  const [total, brags, documentTags, shareLink] = await Promise.all([
    countDocumentBrags(documentId),
    listBrags(documentId, filters),
    listDocumentTags(documentId),
    getActiveShareLink(documentId),
  ]);

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
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <ShareDialog documentId={doc.id} initial={shareLink} />
            <ExportDialog documentId={doc.id} />
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
          <b className="font-medium text-ink">{total}</b> {total === 1 ? "win" : "wins"}
        </div>
      </header>

      <QuickAdd documentId={doc.id} />

      {total === 0 ? (
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
        <div className="flex flex-col gap-5">
          <FilterBar tags={documentTags} />
          {brags.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-card/60 px-6 py-10 text-center text-[13.5px] text-ink-soft shadow-card">
              No brags match these filters.
            </div>
          ) : (
            <Timeline
              brags={brags}
              showGaps={!filtersActive}
              renderCard={(brag) => <BragCard brag={brag} />}
            />
          )}
        </div>
      )}
    </div>
  );
}

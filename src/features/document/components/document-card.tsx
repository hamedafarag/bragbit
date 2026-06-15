import Link from "next/link";

import type { DocumentRow } from "../queries";
import { DocumentActions } from "./document-actions";
import type { DocumentFormValues } from "./document-dialog";

const dateFmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };

/** "Jan 1, 2026 — Dec 31, 2026", or an open-ended variant, or null if no period. */
function formatPeriod(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  // Calendar dates ("YYYY-MM-DD"); parse as local midnight so the day doesn't shift.
  const fmt = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString("en-US", dateFmt);
  if (start && end) return `${fmt(start)} — ${fmt(end)}`;
  return start ? `From ${fmt(start)}` : `Until ${fmt(end!)}`;
}

export function DocumentCard({ doc, archived = false }: { doc: DocumentRow; archived?: boolean }) {
  const period = formatPeriod(doc.periodStart, doc.periodEnd);
  const footer =
    archived && doc.archivedAt
      ? `Archived ${doc.archivedAt.toLocaleDateString("en-US", dateFmt)}`
      : `Updated ${doc.updatedAt.toLocaleDateString("en-US", dateFmt)}`;
  const initial: DocumentFormValues = {
    title: doc.title,
    description: doc.description ?? "",
    periodStart: doc.periodStart ?? "",
    periodEnd: doc.periodEnd ?? "",
    goalsMd: doc.goalsMd ?? "",
  };

  return (
    <li
      className={`rounded-xl border border-line bg-card px-5 py-4 shadow-card transition-shadow hover:shadow-card-hover ${
        archived ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {period ? (
            <div className="font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase">
              {period}
            </div>
          ) : null}
          <h3 className="mt-0.5 font-serif text-[19px] leading-snug font-semibold tracking-[-0.01em]">
            <Link
              href={`/documents/${doc.id}`}
              className="text-ink no-underline hover:underline hover:decoration-line hover:underline-offset-4"
            >
              {doc.title}
            </Link>
          </h3>
          {doc.description ? (
            <p className="mt-1 max-w-[60ch] text-[13.5px] text-ink-soft">{doc.description}</p>
          ) : null}
        </div>
        <DocumentActions
          documentId={doc.id}
          title={doc.title}
          initial={initial}
          archived={archived}
        />
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-dashed border-line-soft pt-2.5 font-mono text-[10px] text-ink-faint">
        <span>{footer}</span>
        {doc.goalsMd ? <span>· goals set</span> : null}
      </div>
    </li>
  );
}

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { searchBrags, type SearchResult } from "@/features/brag/queries";
import { BRAG_CATEGORIES } from "@/features/brag/schema";

const dateFmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };

function categoryMeta(value: string | null) {
  return BRAG_CATEGORIES.find((c) => c.value === value) ?? null;
}

/** A short, markdown-stripped preview for a result. */
function snippet(r: SearchResult): string {
  const text = (r.descriptionMd || r.impactMd || "").replace(/[#*_`>~[\]]/g, "").trim();
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

type Group = { documentId: string; documentTitle: string; results: SearchResult[] };

/** Group rank-ordered results by document, keeping the best-ranked document first. */
function groupByDocument(results: SearchResult[]): Group[] {
  const groups: Group[] = [];
  for (const r of results) {
    const existing = groups.find((g) => g.documentId === r.documentId);
    if (existing) existing.results.push(r);
    else groups.push({ documentId: r.documentId, documentTitle: r.documentTitle, results: [r] });
  }
  return groups;
}

// Global full-text search across the caller's brags in the active workspace.
// searchBrags runs the DAL guard and scopes to the user. Next 16: searchParams is async.
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const term = (q ?? "").trim();
  const results = term ? await searchBrags(term) : [];
  const groups = groupByDocument(results);

  return (
    <div className="flex flex-col gap-7">
      <header>
        <h1 className="font-serif text-[28px] leading-tight font-semibold tracking-[-0.01em]">
          Search
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-soft">
          {term ? (
            <>
              <b className="font-medium text-ink">{results.length}</b>{" "}
              {results.length === 1 ? "result" : "results"} for “{term}”
            </>
          ) : (
            "Search across every brag in your documents — by title, impact, or description."
          )}
        </p>
      </header>

      {term && results.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-card/60 px-6 py-12 text-center shadow-card">
          <p className="text-[13.5px] text-ink-soft">
            No brags match “{term}”. Try different or fewer words.
          </p>
        </div>
      ) : null}

      {groups.map((group) => (
        <section key={group.documentId} className="flex flex-col gap-2">
          <h2 className="font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase">
            <Link href={`/documents/${group.documentId}`} className="no-underline hover:text-ink">
              {group.documentTitle}
            </Link>
          </h2>
          <ul className="flex flex-col gap-2">
            {group.results.map((r) => {
              const cat = categoryMeta(r.category);
              const when = new Date(`${r.date}T00:00:00`).toLocaleDateString("en-US", dateFmt);
              const preview = snippet(r);
              return (
                <li key={r.id}>
                  <Link
                    href={`/documents/${r.documentId}#${r.id}`}
                    className="block rounded-xl border border-line bg-card px-5 py-3.5 no-underline shadow-card transition-shadow hover:shadow-card-hover"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] tracking-[0.08em] text-ink-faint uppercase">
                        {when}
                      </span>
                      {cat ? (
                        <Badge variant="outline">
                          <span className={`size-1.5 rounded-full ${cat.dot}`} />
                          {cat.label}
                        </Badge>
                      ) : null}
                    </div>
                    <h3 className="mt-1 font-serif text-[17px] leading-snug font-semibold tracking-[-0.01em] text-ink">
                      {r.title}
                    </h3>
                    {preview ? (
                      <p className="mt-1 line-clamp-2 max-w-[70ch] text-[13px] text-ink-soft">
                        {preview}
                      </p>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

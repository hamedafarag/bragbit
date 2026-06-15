import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Markdown } from "@/components/shared/markdown";
import { PublicBragCard } from "@/features/share/components/public-brag-card";
import { getSharedDocument } from "@/features/share/queries";
import { Timeline } from "@/features/timeline/components/timeline";
import { accentVars } from "@/lib/utils";

// A share link is a secret URL, not public content: keep it out of search indexes.
export const metadata: Metadata = {
  title: "Shared logbook",
  robots: { index: false, follow: false },
};

const dateFmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };

function formatPeriod(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString("en-US", dateFmt);
  if (start && end) return `${fmt(start)} — ${fmt(end)}`;
  return start ? `From ${fmt(start)}` : `Until ${fmt(end!)}`;
}

/**
 * The public, read-only share page. PUBLIC — outside the (app)/(auth) groups, no
 * session: getSharedDocument authorizes by the token, returns only the document's
 * SHARED brags (private ones filtered at the query layer), and 404s an unknown or
 * revoked token. The page wears the document's workspace brand (accent + logo +
 * name) and renders a read-only month-grouped timeline. Next 16: params is async.
 */
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await getSharedDocument(token);
  if (!shared) notFound();

  const { document: doc, brand, brags } = shared;
  const period = formatPeriod(doc.periodStart, doc.periodEnd);
  const logoUrl = brand.logoKey ? `/api/files/${brand.logoKey}` : null;

  return (
    <div className="relative z-10 flex min-h-screen flex-col" style={accentVars(brand.accentColor)}>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[760px] items-center gap-3 px-6 py-4">
          {logoUrl ? (
            // Authorizing same-origin route, not an optimizable static asset.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={brand.name}
              className="h-7 w-auto max-w-[140px] object-contain"
            />
          ) : (
            <div className="grid size-7 place-items-center rounded-md bg-primary font-serif text-sm font-semibold text-primary-foreground shadow-[inset_0_-6px_10px_rgba(0,0,0,0.18)]">
              {brand.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="font-serif text-[15px] font-semibold">{brand.name}</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[760px] flex-1 px-6 py-10">
        <div className="flex flex-col gap-7">
          <header className="flex flex-col gap-3">
            <div className="font-mono text-[10px] tracking-[0.16em] text-ink-faint uppercase">
              {period ? period : "Shared logbook"}
            </div>
            <h1 className="font-serif text-[40px] leading-[1.05] font-medium tracking-[-0.015em]">
              {doc.title}
            </h1>
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

          {brags.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-card/60 px-6 py-12 text-center text-[13.5px] text-ink-soft shadow-card">
              Nothing has been shared in this logbook yet.
            </div>
          ) : (
            <Timeline
              brags={brags}
              showGaps
              renderCard={(brag) => <PublicBragCard brag={brag} token={token} />}
            />
          )}
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-[760px] px-6 py-5 font-mono text-[10.5px] text-ink-faint">
          Powered by <span className="font-medium text-ink-soft">BragBit</span>
        </div>
      </footer>
    </div>
  );
}

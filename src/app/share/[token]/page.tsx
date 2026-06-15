import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Markdown } from "@/components/shared/markdown";
import { PublicBragCard } from "@/features/share/components/public-brag-card";
import { ShareChrome } from "@/features/share/components/share-chrome";
import { ShareUnlock } from "@/features/share/components/share-unlock";
import { getSharedView } from "@/features/share/queries";
import { Timeline } from "@/features/timeline/components/timeline";

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
 * session: getSharedView authorizes by the token (private brags filtered at the
 * query layer) and 404s an unknown or revoked token. A password-protected share
 * resolves to a `locked` view (only the brand) and renders the unlock gate; an
 * open share renders the document's branded, read-only month-grouped timeline.
 * Next 16: params is async.
 */
export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { token } = await params;
  const view = await getSharedView(token);
  if (!view) notFound();

  if (view.state === "locked") {
    const { e } = await searchParams;
    return (
      <ShareChrome brand={view.brand}>
        <ShareUnlock token={token} errorCode={e} />
      </ShareChrome>
    );
  }

  const { document: doc, brags } = view;
  const period = formatPeriod(doc.periodStart, doc.periodEnd);

  return (
    <ShareChrome brand={view.brand}>
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
    </ShareChrome>
  );
}

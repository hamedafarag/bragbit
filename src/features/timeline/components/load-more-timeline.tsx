"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { BragCard } from "@/features/brag/components/brag-card";
import type { BragFilters, BragWithRelations } from "@/features/brag/queries";

import { loadMoreTimeline } from "../actions";
import { TimelineChunk } from "./timeline";

/** An appended page plus the month it pages off of (its leading-gap reference). */
type Appended = { brags: BragWithRelations[]; prevMonthKey: string };

/**
 * The owner timeline with cursor-paged "load more" (PERF-01). The first page is
 * server-rendered and handed in as `children` — so it paints without JS and works
 * with JS disabled — while older pages load on demand via the `loadMoreTimeline`
 * action and append client-side as {@link TimelineChunk}s. Same shared component
 * as the first page, so appended months are visually identical; no card markup is
 * duplicated and the owner editor never leaves the existing client bundle.
 *
 * `prevMonthKey` for each appended slice is the cursor it was loaded with (the
 * previous page's oldest month), so a quiet-month marker spanning the page
 * boundary stays correct. Because every page is whole months, an appended slice
 * always starts a new month — a header never renders twice across a load.
 *
 * The `.relative` wrapper + spine live here (not in TimelineChunk) so the spine
 * grows with each appended page. The parent remounts this island when the filters
 * change (keyed on them), discarding appended pages back to a fresh first page.
 */
export function LoadMoreTimeline({
  documentId,
  filters,
  initialCursor,
  initialHasMore,
  showGaps,
  children,
}: {
  documentId: string;
  filters: BragFilters;
  initialCursor: string | null;
  initialHasMore: boolean;
  showGaps: boolean;
  children: ReactNode;
}) {
  const [appended, setAppended] = useState<Appended[]>([]);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [pending, start] = useTransition();

  function loadMore() {
    if (!cursor || pending) return;
    const before = cursor;
    start(async () => {
      try {
        const page = await loadMoreTimeline(documentId, filters, before);
        setAppended((prev) => [...prev, { brags: page.brags, prevMonthKey: before }]);
        setCursor(page.nextCursor);
        setHasMore(page.hasMore);
      } catch {
        toast.error("Couldn't load more wins. Try again.");
      }
    });
  }

  return (
    <div className="relative">
      {/* The spine — behind the entries; sticky month headers fade it with their gradient. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-[76px] w-px bg-line"
      />
      {children}
      {appended.map((chunk, i) => (
        <TimelineChunk
          key={`${chunk.prevMonthKey}-${i}`}
          brags={chunk.brags}
          showGaps={showGaps}
          prevMonthKey={chunk.prevMonthKey}
          renderCard={(brag) => <BragCard brag={brag} />}
        />
      ))}
      {hasMore ? (
        <div className="relative flex justify-center pt-5 pb-1">
          <Button type="button" variant="outline" size="sm" onClick={loadMore} disabled={pending}>
            {pending ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

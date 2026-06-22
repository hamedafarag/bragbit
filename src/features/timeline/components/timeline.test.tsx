// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import type { BragWithRelations } from "@/features/brag/queries";
import { render, screen } from "@/test/dom";

import { TimelineChunk } from "./timeline";

// TimelineChunk only reads id/date and hands the brag to renderCard, so a tiny
// cast fixture is enough — we drive the month grouping + quiet-month markers.
const b = (id: string, date: string): BragWithRelations =>
  ({ id, date, title: id }) as unknown as BragWithRelations;

const renderCard = (brag: BragWithRelations) => <div>{brag.title}</div>;

function renderChunk(props: Partial<Parameters<typeof TimelineChunk>[0]> = {}) {
  return render(<TimelineChunk brags={props.brags ?? []} renderCard={renderCard} {...props} />);
}

describe("TimelineChunk", () => {
  it("renders a card for every brag, grouped by month", () => {
    renderChunk({ brags: [b("a", "2026-03-10"), b("b", "2026-03-02"), b("c", "2026-01-20")] });
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("c")).toBeInTheDocument();
    // Two distinct month headers (March, January).
    expect(screen.getByRole("heading", { name: "March" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "January" })).toBeInTheDocument();
  });

  it("marks quiet months between entries when showGaps", () => {
    renderChunk({ brags: [b("a", "2026-03-10"), b("b", "2026-01-05")], showGaps: true });
    // February is the one quiet month between March and January.
    expect(screen.getByText(/1 quiet month/)).toBeInTheDocument();
  });

  it("does not mark gaps when showGaps is off", () => {
    renderChunk({ brags: [b("a", "2026-03-10"), b("b", "2026-01-05")], showGaps: false });
    expect(screen.queryByText(/quiet month/)).toBeNull();
  });

  it("measures the first month's gap against prevMonthKey (the cross-page boundary)", () => {
    // An appended slice whose first month is January, paged off March: the quiet
    // February between the previous page's tail and this one is still shown.
    renderChunk({ brags: [b("a", "2026-01-10")], showGaps: true, prevMonthKey: "2026-03" });
    expect(screen.getByText(/1 quiet month/)).toBeInTheDocument();
  });

  it("shows no leading gap on the first page (prevMonthKey null)", () => {
    renderChunk({ brags: [b("a", "2026-01-10")], showGaps: true, prevMonthKey: null });
    expect(screen.queryByText(/quiet month/)).toBeNull();
  });
});

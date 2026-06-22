// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BragWithRelations } from "@/features/brag/queries";
import { fireEvent, render, screen } from "@/test/dom";

// The action and the (client) BragCard are stubbed: this test owns the append
// state machine, not the query or the card internals.
const action = vi.hoisted(() => ({ loadMoreTimeline: vi.fn() }));
vi.mock("../actions", () => ({ loadMoreTimeline: action.loadMoreTimeline }));
vi.mock("@/features/brag/components/brag-card", () => ({
  BragCard: ({ brag }: { brag: BragWithRelations }) => <div data-testid="card">{brag.title}</div>,
}));
const toastErr = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastErr } }));

import { LoadMoreTimeline } from "./load-more-timeline";

const b = (id: string, date: string): BragWithRelations =>
  ({ id, date, title: id }) as unknown as BragWithRelations;

function setup(props: Partial<Parameters<typeof LoadMoreTimeline>[0]> = {}) {
  return render(
    <LoadMoreTimeline
      documentId="doc-1"
      filters={{}}
      initialCursor="2026-03"
      initialHasMore
      showGaps
      {...props}
    >
      <div>page-one</div>
    </LoadMoreTimeline>,
  );
}

describe("LoadMoreTimeline", () => {
  beforeEach(() => {
    action.loadMoreTimeline.mockReset();
    toastErr.mockReset();
  });

  it("shows Load more only when more pages remain", () => {
    setup({ initialHasMore: false });
    expect(screen.queryByRole("button", { name: /load more/i })).toBeNull();
  });

  it("appends the next page, calling the action with the current cursor", async () => {
    action.loadMoreTimeline.mockResolvedValue({
      brags: [b("Appended win", "2026-02-10")],
      nextCursor: null,
      hasMore: false,
    });
    setup();

    fireEvent.click(screen.getByRole("button", { name: /load more/i }));

    expect(await screen.findByText("Appended win")).toBeInTheDocument();
    expect(action.loadMoreTimeline).toHaveBeenCalledWith("doc-1", {}, "2026-03");
    // The page reported no more, so the button retires.
    expect(screen.queryByRole("button", { name: /load more/i })).toBeNull();
  });

  it("keeps the server-rendered first page visible alongside appended pages", async () => {
    action.loadMoreTimeline.mockResolvedValue({
      brags: [b("Older win", "2026-02-10")],
      nextCursor: null,
      hasMore: false,
    });
    setup();

    fireEvent.click(screen.getByRole("button", { name: /load more/i }));
    await screen.findByText("Older win");
    expect(screen.getByText("page-one")).toBeInTheDocument();
  });

  it("toasts and keeps the button when the action fails", async () => {
    action.loadMoreTimeline.mockRejectedValue(new Error("boom"));
    setup();

    fireEvent.click(screen.getByRole("button", { name: /load more/i }));

    await vi.waitFor(() => expect(toastErr).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
  });
});

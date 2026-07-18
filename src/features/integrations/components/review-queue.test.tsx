// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
const toastFns = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const actions = vi.hoisted(() => ({
  approveCandidate: vi.fn(async () => ({ ok: true }) as { ok: boolean; error?: string }),
  dismissCandidate: vi.fn(async () => ({ ok: true }) as { ok: boolean; error?: string }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: nav.refresh }) }));
vi.mock("sonner", () => ({ toast: toastFns }));
vi.mock("../actions", () => actions);

import { ReviewQueue, type CandidateView } from "./review-queue";

const candidates: CandidateView[] = [
  {
    id: "c1",
    provider: "github",
    title: "Ship the crew heatmap",
    externalUrl: "https://github.com/acme/web/pull/42",
    occurredAt: "2026-03-01T00:00:00.000Z",
  },
];
const documents = [
  { id: "d1", title: "2026" },
  { id: "d2", title: "H1 Review" },
];

beforeEach(() => vi.clearAllMocks());

describe("ReviewQueue — rendering", () => {
  it("lists candidates with enabled approve/dismiss when a document exists", () => {
    render(<ReviewQueue candidates={candidates} documents={documents} />);
    expect(screen.getByText("Ship the crew heatmap")).toBeInTheDocument();
    expect((screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  it("blocks approving and prompts to create a document when there are none", () => {
    render(<ReviewQueue candidates={candidates} documents={[]} />);
    expect(screen.getByText(/Create a document first/)).toBeInTheDocument();
    expect((screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

describe("ReviewQueue — actions", () => {
  it("approves into the default (first) document, then toasts and refreshes", async () => {
    render(<ReviewQueue candidates={candidates} documents={documents} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(actions.approveCandidate).toHaveBeenCalledWith("c1", "d1"));
    expect(toastFns.success).toHaveBeenCalledWith("Brag added.");
    expect(nav.refresh).toHaveBeenCalled();
  });

  it("approves into the document the user picks", async () => {
    render(<ReviewQueue candidates={candidates} documents={documents} />);
    fireEvent.change(screen.getByLabelText("Add approved brags to"), { target: { value: "d2" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(actions.approveCandidate).toHaveBeenCalledWith("c1", "d2"));
  });

  it("dismisses a candidate, then toasts and refreshes", async () => {
    render(<ReviewQueue candidates={candidates} documents={documents} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() => expect(actions.dismissCandidate).toHaveBeenCalledWith("c1"));
    expect(toastFns.success).toHaveBeenCalledWith("Dismissed.");
    expect(nav.refresh).toHaveBeenCalled();
  });

  it("surfaces an error and does not refresh when approve fails", async () => {
    actions.approveCandidate.mockResolvedValueOnce({ ok: false, error: "Candidate not found." });
    render(<ReviewQueue candidates={candidates} documents={documents} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(toastFns.error).toHaveBeenCalledWith("Candidate not found."));
    expect(nav.refresh).not.toHaveBeenCalled();
  });
});

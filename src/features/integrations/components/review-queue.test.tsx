// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test/dom";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../actions", () => ({
  approveCandidate: vi.fn(async () => ({ ok: true })),
  dismissCandidate: vi.fn(async () => ({ ok: true })),
}));

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

describe("ReviewQueue", () => {
  it("lists candidates with approve/dismiss when a document exists", () => {
    render(<ReviewQueue candidates={candidates} documents={[{ id: "d1", title: "2026" }]} />);
    expect(screen.getByText("Ship the crew heatmap")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeTruthy();
  });

  it("blocks approving and prompts to create a document when there are none", () => {
    render(<ReviewQueue candidates={candidates} documents={[]} />);
    expect(screen.getByText(/Create a document first/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

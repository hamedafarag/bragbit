// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen } from "@/test/dom";

// Router state the component reads/writes; hoisted so the mock factory can close
// over it (vi.mock is hoisted above module-level declarations).
const nav = vi.hoisted(() => ({ push: vi.fn(), search: "" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push }),
  usePathname: () => "/documents/doc-1",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

import { FilterBar } from "./filter-bar";

describe("FilterBar", () => {
  beforeEach(() => {
    nav.push.mockClear();
    nav.search = "";
  });

  it("pushes a chosen category into the query string", () => {
    render(<FilterBar tags={[]} />);
    fireEvent.change(screen.getByLabelText("Filter by category"), {
      target: { value: "leadership" },
    });
    expect(nav.push).toHaveBeenCalledWith("/documents/doc-1?category=leadership");
  });

  it("pushes a chosen tag", () => {
    render(<FilterBar tags={["ci", "devex"]} />);
    fireEvent.change(screen.getByLabelText("Filter by tag"), { target: { value: "ci" } });
    expect(nav.push).toHaveBeenCalledWith("/documents/doc-1?tag=ci");
  });

  it("pushes a from-date", () => {
    render(<FilterBar tags={[]} />);
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-01-01" } });
    expect(nav.push).toHaveBeenCalledWith("/documents/doc-1?from=2026-01-01");
  });

  it("only renders the tag filter when the document has tags", () => {
    const { rerender } = render(<FilterBar tags={[]} />);
    expect(screen.queryByLabelText("Filter by tag")).toBeNull();
    rerender(<FilterBar tags={["ci"]} />);
    expect(screen.getByLabelText("Filter by tag")).toBeInTheDocument();
  });

  it("drops a param when it is set back to empty", () => {
    nav.search = "category=leadership";
    render(<FilterBar tags={[]} />);
    fireEvent.change(screen.getByLabelText("Filter by category"), { target: { value: "" } });
    expect(nav.push).toHaveBeenCalledWith("/documents/doc-1");
  });

  it("shows Clear only when a filter is active and resets to the bare path", () => {
    nav.search = "category=leadership";
    render(<FilterBar tags={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(nav.push).toHaveBeenCalledWith("/documents/doc-1");
  });

  it("hides Clear when no filter is active", () => {
    render(<FilterBar tags={[]} />);
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });
});

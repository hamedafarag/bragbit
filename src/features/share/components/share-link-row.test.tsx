// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen } from "@/test/dom";

import { ShareLinkRow } from "./share-link-row";

const URL = "https://x.test/s/abc";

describe("ShareLinkRow", () => {
  it("shows the url and the not-opened state", () => {
    render(<ShareLinkRow url={URL} lastAccessedAt={null} copied={false} onCopy={() => {}} />);
    expect(screen.getByLabelText("Share link")).toHaveValue(URL);
    expect(screen.getByText("Not opened yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
  });

  it("selects its text on focus", () => {
    const select = vi.spyOn(HTMLInputElement.prototype, "select");
    render(<ShareLinkRow url={URL} lastAccessedAt={null} copied={false} onCopy={() => {}} />);
    fireEvent.focus(screen.getByLabelText("Share link"));
    expect(select).toHaveBeenCalled();
    select.mockRestore();
  });

  it("calls onCopy when the copy button is clicked", () => {
    const onCopy = vi.fn();
    render(<ShareLinkRow url={URL} lastAccessedAt={null} copied={false} onCopy={onCopy} />);
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    expect(onCopy).toHaveBeenCalledOnce();
  });

  it("shows the copied state and a last-opened line", () => {
    render(
      <ShareLinkRow
        url={URL}
        lastAccessedAt="2026-06-20T10:00:00Z"
        copied={true}
        onCopy={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();
    expect(screen.getByText(/Last opened/)).toBeInTheDocument();
  });
});

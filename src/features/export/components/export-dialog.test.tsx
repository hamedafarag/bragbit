// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen } from "@/test/dom";

vi.mock("@/components/ui/dialog", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Dialog: Pass,
    DialogTrigger: Pass,
    DialogContent: Pass,
    DialogHeader: Pass,
    DialogTitle: Pass,
    DialogDescription: Pass,
  };
});

import { ExportDialog } from "./export-dialog";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ExportDialog", () => {
  it("downloads Markdown with private brags excluded by default", () => {
    let href = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      href = this.href;
    });
    render(<ExportDialog documentId="doc-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Download Markdown" }));
    expect(href).toContain("/api/export/doc-1?format=md&private=0");
  });

  it("includes private brags once the box is checked", () => {
    let href = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      href = this.href;
    });
    render(<ExportDialog documentId="doc-1" />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Download Markdown" }));
    expect(href).toContain("private=1");
  });

  it("opens the print view in a new tab", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<ExportDialog documentId="doc-1" />);
    fireEvent.click(screen.getByRole("button", { name: /Print \/ Save as PDF/ }));
    expect(open).toHaveBeenCalledWith("/print/doc-1?private=0", "_blank", "noopener");
  });
});

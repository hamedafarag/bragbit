// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen } from "@/test/dom";

// Stub the lazily-loaded preview so the test doesn't pull in react-markdown.
vi.mock("next/dynamic", () => ({
  default: () => (props: { children?: ReactNode }) => (
    <div data-testid="md-preview">{props.children}</div>
  ),
}));

import { MarkdownField } from "./markdown-field";

describe("MarkdownField", () => {
  it("renders a textarea seeded from defaultValue", () => {
    render(<MarkdownField id="f" name="desc" defaultValue="hello" />);
    expect(screen.getByRole("textbox")).toHaveValue("hello");
  });

  it("tracks what you type", () => {
    render(<MarkdownField id="f" name="desc" />);
    const ta = screen.getByRole("textbox");
    fireEvent.change(ta, { target: { value: "world" } });
    expect(ta).toHaveValue("world");
  });

  it("shows the empty hint when previewing nothing", () => {
    render(<MarkdownField id="f" name="desc" />);
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByText("Nothing to preview yet.")).toBeInTheDocument();
  });

  it("renders the preview for non-empty content", () => {
    render(<MarkdownField id="f" name="desc" defaultValue="# Title" />);
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByTestId("md-preview")).toHaveTextContent("# Title");
  });
});

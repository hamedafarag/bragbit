// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { refresh, quickAddBrag, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  quickAddBrag: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../actions", () => ({ quickAddBrag }));
vi.mock("sonner", () => ({ toast }));
vi.mock("./brag-editor", () => ({
  BragEditor: (props: { trigger?: ReactNode }) => <div>{props.trigger}</div>,
}));

import { QuickAdd } from "./quick-add";

const PLACEHOLDER = /only a title is required/i;

afterEach(() => {
  vi.clearAllMocks();
});

describe("QuickAdd", () => {
  it("renders the capture box with the formula and the details link", () => {
    render(<QuickAdd documentId="doc-1" />);
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeInTheDocument();
    expect(screen.getByText(/FORMULA/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add with details/i })).toBeInTheDocument();
  });

  it("logs a win, clears the input, and refreshes on success", async () => {
    quickAddBrag.mockResolvedValue({ ok: true });
    render(<QuickAdd documentId="doc-1" />);
    const input = screen.getByPlaceholderText(PLACEHOLDER);
    fireEvent.change(input, { target: { value: "Shipped the thing" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(quickAddBrag).toHaveBeenCalledWith(
        "doc-1",
        expect.objectContaining({ title: "Shipped the thing" }),
      ),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(input).toHaveValue("");
    expect(refresh).toHaveBeenCalled();
  });

  it("does not submit an empty title", () => {
    render(<QuickAdd documentId="doc-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(quickAddBrag).not.toHaveBeenCalled();
  });

  it("surfaces the action's error", async () => {
    quickAddBrag.mockResolvedValue({ ok: false, error: "nope" });
    render(<QuickAdd documentId="doc-1" />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("nope"));
  });

  it("focuses the capture box when 'n' is pressed", () => {
    render(<QuickAdd documentId="doc-1" />);
    const input = screen.getByPlaceholderText(PLACEHOLDER);
    expect(input).not.toHaveFocus();
    fireEvent.keyDown(document, { key: "n" });
    expect(input).toHaveFocus();
  });
});

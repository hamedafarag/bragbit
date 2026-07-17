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

import { DashboardCapture } from "./dashboard-capture";

const PLACEHOLDER = /only a title is required/i;
const ONE = [{ id: "doc-new", title: "2026 Wins" }];
const MANY = [
  { id: "doc-new", title: "2026 Wins" },
  { id: "doc-old", title: "2025 Review" },
];

afterEach(() => {
  vi.clearAllMocks();
});

describe("DashboardCapture", () => {
  it("shows the target as static text with a single document", () => {
    render(<DashboardCapture documents={ONE} />);
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeInTheDocument();
    expect(screen.getByText("2026 Wins")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("offers a selector, defaulting to the first (most-recent) document", () => {
    render(<DashboardCapture documents={MANY} />);
    const select = screen.getByRole("combobox");
    expect((select as HTMLSelectElement).value).toBe("doc-new");
  });

  it("logs to the default document, clears the input, and refreshes", async () => {
    quickAddBrag.mockResolvedValue({ ok: true });
    render(<DashboardCapture documents={ONE} />);
    const input = screen.getByPlaceholderText(PLACEHOLDER);
    fireEvent.change(input, { target: { value: "Shipped the thing" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(quickAddBrag).toHaveBeenCalledWith(
        "doc-new",
        expect.objectContaining({ title: "Shipped the thing" }),
      ),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(input).toHaveValue("");
    expect(refresh).toHaveBeenCalled();
  });

  it("logs to the chosen document after switching the target", async () => {
    quickAddBrag.mockResolvedValue({ ok: true });
    render(<DashboardCapture documents={MANY} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "doc-old" } });
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: "A win" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(quickAddBrag).toHaveBeenCalledWith(
        "doc-old",
        expect.objectContaining({ title: "A win" }),
      ),
    );
  });

  it("does not submit an empty title", () => {
    render(<DashboardCapture documents={ONE} />);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(quickAddBrag).not.toHaveBeenCalled();
  });

  it("focuses the capture box when 'n' is pressed", () => {
    render(<DashboardCapture documents={ONE} />);
    const input = screen.getByPlaceholderText(PLACEHOLDER);
    expect(input).not.toHaveFocus();
    fireEvent.keyDown(document, { key: "n" });
    expect(input).toHaveFocus();
  });
});

// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { refresh, createBrag, updateBrag, getTagSuggestions, parseBragForm, toast } = vi.hoisted(
  () => ({
    refresh: vi.fn(),
    createBrag: vi.fn(),
    updateBrag: vi.fn(),
    getTagSuggestions: vi.fn(async () => []),
    parseBragForm: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn() },
  }),
);

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../actions", () => ({ createBrag, updateBrag, getTagSuggestions }));
vi.mock("../form", () => ({ parseBragForm }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/ui/dialog", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Dialog: Pass,
    DialogTrigger: Pass,
    DialogContent: Pass,
    DialogHeader: Pass,
    DialogTitle: Pass,
    DialogDescription: Pass,
    DialogFooter: Pass,
    DialogClose: Pass,
  };
});
// The field sub-components are tested on their own; stub them so this test isolates
// the editor's submit orchestration (parse → create/update → toast/refresh).
vi.mock("./brag-meta-fields", () => ({ BragMetaFields: () => <div /> }));
vi.mock("./markdown-field", () => ({ MarkdownField: () => <div /> }));
vi.mock("./tags-field", () => ({ TagsField: () => <div /> }));
vi.mock("./links-field", () => ({ LinksField: () => <div /> }));
vi.mock("./brag-attribution-fields", () => ({ BragAttributionFields: () => <div /> }));
vi.mock("@/features/attachment/components/attachment-manager", () => ({
  AttachmentManager: () => <div>attachment-manager</div>,
}));

import { BragEditor } from "./brag-editor";

const DATA = { title: "Win", date: "2026-03-15" };

afterEach(() => {
  vi.clearAllMocks();
});

function renderEditor(props: { bragId?: string } = {}) {
  const utils = render(
    <BragEditor documentId="doc-1" trigger={<button>Open</button>} {...props} />,
  );
  return { ...utils, form: utils.container.querySelector("form")! };
}

describe("BragEditor", () => {
  it("creates a brag on a valid submit", async () => {
    parseBragForm.mockReturnValue({ success: true, data: DATA });
    createBrag.mockResolvedValue({ ok: true });
    const { form } = renderEditor();
    fireEvent.submit(form);

    await waitFor(() => expect(createBrag).toHaveBeenCalledWith("doc-1", DATA));
    expect(toast.success).toHaveBeenCalledWith("Win logged.");
    expect(refresh).toHaveBeenCalled();
  });

  it("updates an existing brag in edit mode", async () => {
    parseBragForm.mockReturnValue({ success: true, data: DATA });
    updateBrag.mockResolvedValue({ ok: true });
    const { form } = renderEditor({ bragId: "brag-1" });
    fireEvent.submit(form);

    await waitFor(() => expect(updateBrag).toHaveBeenCalledWith("brag-1", DATA));
    expect(toast.success).toHaveBeenCalledWith("Brag updated.");
    expect(createBrag).not.toHaveBeenCalled();
  });

  it("toasts a validation error without calling the action", () => {
    parseBragForm.mockReturnValue({
      success: false,
      error: { issues: [{ message: "Title required" }] },
    });
    const { form } = renderEditor();
    fireEvent.submit(form);
    expect(createBrag).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Title required");
  });

  it("surfaces an action error", async () => {
    parseBragForm.mockReturnValue({ success: true, data: DATA });
    createBrag.mockResolvedValue({ ok: false, error: "Could not save." });
    const { form } = renderEditor();
    fireEvent.submit(form);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not save."));
  });

  it("shows the attachment manager only in edit mode", () => {
    const trigger = <button>Open</button>;
    const { rerender } = render(<BragEditor documentId="doc-1" trigger={trigger} />);
    expect(screen.queryByText("attachment-manager")).toBeNull();
    rerender(<BragEditor documentId="doc-1" bragId="brag-1" trigger={trigger} />);
    expect(screen.getByText("attachment-manager")).toBeInTheDocument();
  });
});

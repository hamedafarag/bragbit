// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { refresh, createDocument, updateDocument, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../actions", () => ({ createDocument, updateDocument }));
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

import { DocumentDialog, type DocumentFormValues } from "./document-dialog";

const INITIAL: DocumentFormValues = {
  title: "2026",
  description: "The year of shipping",
  periodStart: "",
  periodEnd: "",
  goalsMd: "",
};

afterEach(() => {
  vi.clearAllMocks();
});

function renderDialog(props: { documentId?: string; initial?: DocumentFormValues } = {}) {
  const utils = render(<DocumentDialog trigger={<button>Open</button>} {...props} />);
  return { ...utils, form: utils.container.querySelector("form")! };
}

describe("DocumentDialog", () => {
  it("creates a document on success", async () => {
    createDocument.mockResolvedValue({ ok: true });
    const { form } = renderDialog();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "2026" } });
    fireEvent.submit(form);

    await waitFor(() =>
      expect(createDocument).toHaveBeenCalledWith(
        expect.objectContaining({ title: "2026", description: "" }),
      ),
    );
    expect(toast.success).toHaveBeenCalledWith("Document created.");
    expect(refresh).toHaveBeenCalled();
  });

  it("updates an existing document in edit mode", async () => {
    updateDocument.mockResolvedValue({ ok: true });
    const { form } = renderDialog({ documentId: "doc-1", initial: INITIAL });
    fireEvent.submit(form);

    await waitFor(() =>
      expect(updateDocument).toHaveBeenCalledWith(
        "doc-1",
        expect.objectContaining({ title: "2026" }),
      ),
    );
    expect(toast.success).toHaveBeenCalledWith("Document updated.");
    expect(createDocument).not.toHaveBeenCalled();
  });

  it("blocks an empty title", () => {
    const { form } = renderDialog();
    fireEvent.submit(form);
    expect(createDocument).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("surfaces an action error", async () => {
    createDocument.mockResolvedValue({ ok: false, error: "Could not create." });
    const { form } = renderDialog();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "2026" } });
    fireEvent.submit(form);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not create."));
  });
});

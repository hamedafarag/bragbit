// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { refresh, archiveDocument, unarchiveDocument, deleteDocument, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  archiveDocument: vi.fn(),
  unarchiveDocument: vi.fn(),
  deleteDocument: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../actions", () => ({ archiveDocument, unarchiveDocument, deleteDocument }));
// Stub the nested edit dialog — not under test here, and it pulls in its own actions.
vi.mock("./document-dialog", () => ({ DocumentDialog: () => <div>edit-dialog</div> }));
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

import { DocumentActions } from "./document-actions";

const BASE = {
  documentId: "doc-1",
  title: "2026",
  initial: { title: "2026", description: "", periodStart: "", periodEnd: "", goalsMd: "" },
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("DocumentActions", () => {
  it("archives an active document", async () => {
    archiveDocument.mockResolvedValue({ ok: true });
    render(<DocumentActions {...BASE} />);
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(archiveDocument).toHaveBeenCalledWith("doc-1"));
    expect(toast.success).toHaveBeenCalledWith("Document archived.");
  });

  it("deletes from the confirm dialog", async () => {
    deleteDocument.mockResolvedValue({ ok: true });
    render(<DocumentActions {...BASE} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete document" }));
    await waitFor(() => expect(deleteDocument).toHaveBeenCalledWith("doc-1"));
    expect(toast.success).toHaveBeenCalledWith("Document deleted.");
  });

  it("restores an archived document (no Archive button)", async () => {
    unarchiveDocument.mockResolvedValue({ ok: true });
    render(<DocumentActions {...BASE} archived />);
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(unarchiveDocument).toHaveBeenCalledWith("doc-1"));
    expect(toast.success).toHaveBeenCalledWith("Document restored.");
  });

  it("surfaces a delete error", async () => {
    deleteDocument.mockResolvedValue({ ok: false, error: "Nope." });
    render(<DocumentActions {...BASE} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete document" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nope."));
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { refresh, deleteAttachment, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  deleteAttachment: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../actions", () => ({ deleteAttachment }));
vi.mock("sonner", () => ({ toast }));

import { AttachmentManager, formatBytes, type AttachmentItem } from "./attachment-manager";

const ITEM: AttachmentItem = {
  id: "a1",
  fileName: "doc.pdf",
  mimeType: "application/pdf",
  sizeBytes: 2048,
  url: "/api/files/ws/attachments/a1.pdf",
};

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("formatBytes", () => {
  it("formats bytes, KB, and MB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});

describe("AttachmentManager", () => {
  function setup(initial: AttachmentItem[] = []) {
    const utils = render(<AttachmentManager bragId="b1" initial={initial} />);
    return {
      ...utils,
      input: utils.container.querySelector('input[type="file"]') as HTMLInputElement,
    };
  }
  const drop = (input: HTMLInputElement, name = "doc.pdf") =>
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array(4)], name, { type: "application/pdf" })] },
    });

  it("lists existing attachments with their size", () => {
    setup([ITEM]);
    expect(screen.getByText("doc.pdf")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();
  });

  it("uploads selected files and appends them", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ attachments: [ITEM] }) });
    const { input } = setup();
    drop(input);

    expect(await screen.findByText("doc.pdf")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/upload/attachment",
      expect.objectContaining({ method: "POST" }),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it("surfaces an upload error returned by the route", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Too big." }) });
    const { input } = setup();
    drop(input);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Too big."));
  });

  it("toasts on a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    const { input } = setup();
    drop(input);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Upload failed."));
  });

  it("deletes an attachment and drops it from the list", async () => {
    deleteAttachment.mockResolvedValue({ ok: true });
    setup([ITEM]);
    fireEvent.click(screen.getByRole("button", { name: "Remove doc.pdf" }));
    await waitFor(() => expect(deleteAttachment).toHaveBeenCalledWith("a1"));
    await waitFor(() => expect(screen.queryByText("doc.pdf")).toBeNull());
  });

  it("surfaces a delete error", async () => {
    deleteAttachment.mockResolvedValue({ ok: false, error: "Nope." });
    setup([ITEM]);
    fireEvent.click(screen.getByRole("button", { name: "Remove doc.pdf" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nope."));
  });
});

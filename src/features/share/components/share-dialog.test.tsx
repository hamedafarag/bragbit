// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";
import type { ShareLinkView } from "../queries";

const {
  refresh,
  createShareLink,
  revokeShareLink,
  rotateShareLink,
  setSharePassword,
  removeSharePassword,
  toast,
} = vi.hoisted(() => ({
  refresh: vi.fn(),
  createShareLink: vi.fn(),
  revokeShareLink: vi.fn(),
  rotateShareLink: vi.fn(),
  setSharePassword: vi.fn(),
  removeSharePassword: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../actions", () => ({
  createShareLink,
  revokeShareLink,
  rotateShareLink,
  setSharePassword,
  removeSharePassword,
}));
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
  };
});
// Stub the presentational children (tested on their own) to expose just the
// callbacks the dialog wires up.
vi.mock("./share-link-row", () => ({
  ShareLinkRow: ({ url, onCopy }: { url: string; onCopy: () => void }) => (
    <div>
      <span data-testid="share-url">{url}</span>
      <button onClick={onCopy}>copy-link</button>
    </div>
  ),
}));
vi.mock("./share-password-panel", () => ({
  SharePasswordPanel: ({
    hasPassword,
    pw,
    onPwChange,
    onSet,
    onRemove,
  }: {
    hasPassword: boolean;
    pw: string;
    onPwChange: (v: string) => void;
    onSet: () => void;
    onRemove: () => void;
  }) => (
    <div>
      <span data-testid="has-pw">{hasPassword ? "yes" : "no"}</span>
      <input aria-label="pw" value={pw} onChange={(e) => onPwChange(e.target.value)} />
      <button onClick={onSet}>set-pw</button>
      <button onClick={onRemove}>remove-pw</button>
    </div>
  ),
}));

import { ShareDialog } from "./share-dialog";

const LINK = (over: Partial<ShareLinkView> = {}): ShareLinkView =>
  ({
    url: "https://x/share/tok",
    lastAccessedAt: null,
    hasPassword: false,
    ...over,
  }) as unknown as ShareLinkView;

beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(() => Promise.resolve()) },
  });
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("ShareDialog", () => {
  it("creates a share link from the empty state", async () => {
    createShareLink.mockResolvedValue({ ok: true, link: LINK() });
    render(<ShareDialog documentId="d1" initial={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Create share link" }));

    await waitFor(() => expect(createShareLink).toHaveBeenCalledWith("d1"));
    expect(await screen.findByTestId("share-url")).toHaveTextContent("https://x/share/tok");
    expect(toast.success).toHaveBeenCalled();
  });

  it("surfaces a create error", async () => {
    createShareLink.mockResolvedValue({ ok: false, error: "Nope." });
    render(<ShareDialog documentId="d1" initial={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Create share link" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nope."));
  });

  it("rotates the link", async () => {
    rotateShareLink.mockResolvedValue({ ok: true, link: LINK({ url: "https://x/share/new" }) });
    render(<ShareDialog documentId="d1" initial={LINK()} />);
    fireEvent.click(screen.getByRole("button", { name: /Rotate link/ }));
    await waitFor(() => expect(rotateShareLink).toHaveBeenCalledWith("d1"));
    expect(screen.getByTestId("share-url")).toHaveTextContent("https://x/share/new");
  });

  it("stops sharing and returns to the empty state", async () => {
    revokeShareLink.mockResolvedValue({ ok: true });
    render(<ShareDialog documentId="d1" initial={LINK()} />);
    fireEvent.click(screen.getByRole("button", { name: "Stop sharing" }));
    await waitFor(() => expect(revokeShareLink).toHaveBeenCalledWith("d1"));
    expect(await screen.findByRole("button", { name: "Create share link" })).toBeInTheDocument();
  });

  it("copies the link to the clipboard", async () => {
    render(<ShareDialog documentId="d1" initial={LINK()} />);
    fireEvent.click(screen.getByRole("button", { name: "copy-link" }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://x/share/tok"),
    );
    expect(toast.success).toHaveBeenCalledWith("Link copied.");
  });

  it("sets and removes a password", async () => {
    setSharePassword.mockResolvedValue({ ok: true });
    removeSharePassword.mockResolvedValue({ ok: true });
    render(<ShareDialog documentId="d1" initial={LINK()} />);

    fireEvent.change(screen.getByLabelText("pw"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "set-pw" }));
    await waitFor(() => expect(setSharePassword).toHaveBeenCalledWith("d1", "secret"));
    expect(screen.getByTestId("has-pw")).toHaveTextContent("yes");

    fireEvent.click(screen.getByRole("button", { name: "remove-pw" }));
    await waitFor(() => expect(removeSharePassword).toHaveBeenCalledWith("d1"));
    expect(screen.getByTestId("has-pw")).toHaveTextContent("no");
  });
});

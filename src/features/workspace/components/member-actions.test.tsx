// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { refresh, removeMember, transferOwnership, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  removeMember: vi.fn(),
  transferOwnership: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../actions", () => ({ removeMember, transferOwnership }));
vi.mock("sonner", () => ({ toast }));
// Render dialogs inline so both confirm buttons are reachable without Radix's portal.
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

import { MemberActions } from "./member-actions";

const BASE = { memberId: "m1", memberName: "Ada", workspaceName: "Acme" };

afterEach(() => {
  vi.clearAllMocks();
});

describe("MemberActions", () => {
  it("renders nothing when the caller can neither remove nor transfer", () => {
    render(<MemberActions {...BASE} canRemove={false} canTransfer={false} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("transfers ownership from the confirm dialog", async () => {
    transferOwnership.mockResolvedValue({ ok: true });
    render(<MemberActions {...BASE} canRemove={false} canTransfer />);
    // The trigger and the confirm both read "Make owner"; the confirm is the last.
    const buttons = screen.getAllByRole("button", { name: "Make owner" });
    fireEvent.click(buttons[buttons.length - 1]!);

    await waitFor(() => expect(transferOwnership).toHaveBeenCalledWith("m1"));
    expect(toast.success).toHaveBeenCalledWith("Ownership transferred.");
  });

  it("removes a member from the confirm dialog", async () => {
    removeMember.mockResolvedValue({ ok: true });
    render(<MemberActions {...BASE} canRemove canTransfer={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove member" }));

    await waitFor(() => expect(removeMember).toHaveBeenCalledWith("m1"));
    expect(toast.success).toHaveBeenCalledWith("Member removed.");
  });

  it("surfaces an error without closing", async () => {
    removeMember.mockResolvedValue({ ok: false, error: "Can't remove the owner." });
    render(<MemberActions {...BASE} canRemove canTransfer={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove member" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Can't remove the owner."));
  });
});

// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { push, refresh, switchWs, toast } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  switchWs: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("../actions", () => ({ switchWorkspace: switchWs }));
vi.mock("sonner", () => ({ toast }));
// Render the dialog inline (trigger + content always shown) so the list is testable
// without driving Radix's portal/open behavior in jsdom.
vi.mock("@/components/ui/dialog", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Dialog: Pass,
    DialogTrigger: Pass,
    DialogContent: Pass,
    DialogHeader: Pass,
    DialogTitle: Pass,
  };
});

import { WorkspaceSwitcher } from "./workspace-switcher";

const WS = [
  { id: "ws-personal", name: "My Logbook", type: "personal", role: "owner", isActive: true },
  { id: "ws-acme", name: "Acme Corp", type: "organization", role: "owner", isActive: false },
];

afterEach(() => {
  vi.clearAllMocks();
});

describe("WorkspaceSwitcher", () => {
  it("shows the active workspace, lists all, and offers create-organization", () => {
    render(<WorkspaceSwitcher workspaces={WS} />);
    expect(screen.getByLabelText("Switch workspace")).toHaveTextContent("My Logbook");
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create organization/i })).toBeInTheDocument();
  });

  it("switches to another workspace and navigates to the dashboard", async () => {
    switchWs.mockResolvedValue({ ok: true });
    render(<WorkspaceSwitcher workspaces={WS} />);
    fireEvent.click(screen.getByText("Acme Corp").closest("button")!);

    await waitFor(() => expect(switchWs).toHaveBeenCalledWith("ws-acme"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
  });

  it("surfaces a switch error and does not navigate", async () => {
    switchWs.mockResolvedValue({ ok: false, error: "Workspace not found." });
    render(<WorkspaceSwitcher workspaces={WS} />);
    fireEvent.click(screen.getByText("Acme Corp").closest("button")!);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Workspace not found."));
    expect(push).not.toHaveBeenCalled();
  });
});

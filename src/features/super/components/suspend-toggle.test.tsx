// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { refresh, setWs, setUser, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  setWs: vi.fn(),
  setUser: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../actions", () => ({ setWorkspaceSuspended: setWs, setUserSuspended: setUser }));
vi.mock("sonner", () => ({ toast }));

import { SuspendToggle } from "./suspend-toggle";

afterEach(() => {
  vi.clearAllMocks();
});

describe("SuspendToggle", () => {
  it("suspends a workspace and refreshes", async () => {
    setWs.mockResolvedValue({ ok: true });
    render(<SuspendToggle kind="workspace" id="org-1" suspended={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Suspend" }));
    await waitFor(() => expect(setWs).toHaveBeenCalledWith("org-1", true));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("unsuspends a user (the label flips when already suspended)", async () => {
    setUser.mockResolvedValue({ ok: true });
    render(<SuspendToggle kind="user" id="user-1" suspended={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Unsuspend" }));
    await waitFor(() => expect(setUser).toHaveBeenCalledWith("user-1", false));
  });

  it("surfaces an error and does not refresh", async () => {
    setWs.mockResolvedValue({ ok: false, error: "nope" });
    render(<SuspendToggle kind="workspace" id="org-1" suspended={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Suspend" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("nope"));
    expect(refresh).not.toHaveBeenCalled();
  });
});

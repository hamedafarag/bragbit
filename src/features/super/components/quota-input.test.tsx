// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { refresh, setQuota, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  setQuota: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../actions", () => ({ setWorkspaceQuota: setQuota }));
vi.mock("sonner", () => ({ toast }));

import { QuotaInput } from "./quota-input";

afterEach(() => {
  vi.clearAllMocks();
});

describe("QuotaInput", () => {
  it("saves a positive quota", async () => {
    setQuota.mockResolvedValue({ ok: true });
    render(<QuotaInput orgId="org-1" quotaMb={null} defaultQuotaMb={2048} />);
    fireEvent.change(screen.getByLabelText("Storage quota in MB"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(setQuota).toHaveBeenCalledWith("org-1", 500));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("clears the quota with a blank value (null restores the default)", async () => {
    setQuota.mockResolvedValue({ ok: true });
    render(<QuotaInput orgId="org-1" quotaMb={500} defaultQuotaMb={2048} />);
    fireEvent.change(screen.getByLabelText("Storage quota in MB"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(setQuota).toHaveBeenCalledWith("org-1", null));
  });

  it("rejects a non-positive value without calling the action", () => {
    render(<QuotaInput orgId="org-1" quotaMb={null} defaultQuotaMb={2048} />);
    fireEvent.change(screen.getByLabelText("Storage quota in MB"), { target: { value: "-3" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(setQuota).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { changePassword, toast } = vi.hoisted(() => ({
  changePassword: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/auth/client", () => ({ authClient: { changePassword } }));
vi.mock("sonner", () => ({ toast }));

import { ChangePasswordForm } from "./change-password-form";

afterEach(() => {
  vi.clearAllMocks();
});

function renderForm() {
  const utils = render(<ChangePasswordForm />);
  return { ...utils, form: utils.container.querySelector("form")! };
}

function fill(over: Partial<{ current: string; next: string }> = {}) {
  fireEvent.change(screen.getByLabelText("Current password"), {
    target: { value: over.current ?? "oldsecret1" },
  });
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: over.next ?? "newsecret1" },
  });
}

describe("ChangePasswordForm", () => {
  it("renders current and new password fields", () => {
    renderForm();
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
  });

  it("changes the password and revokes other sessions on success", async () => {
    changePassword.mockResolvedValue({ error: null });
    const { form } = renderForm();
    fill();
    fireEvent.submit(form);

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: "oldsecret1",
        newPassword: "newsecret1",
        revokeOtherSessions: true,
      }),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it("blocks a too-short new password before calling the API", () => {
    const { form } = renderForm();
    fill({ next: "short" });
    fireEvent.submit(form);
    expect(changePassword).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("surfaces an API error", async () => {
    changePassword.mockResolvedValue({ error: { message: "Wrong current password." } });
    const { form } = renderForm();
    fill();
    fireEvent.submit(form);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Wrong current password."));
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { push, resetPassword, toast } = vi.hoisted(() => ({
  push: vi.fn(),
  resetPassword: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/auth/client", () => ({ authClient: { resetPassword } }));
vi.mock("sonner", () => ({ toast }));

import { ResetPasswordForm } from "./reset-password-form";

afterEach(() => {
  vi.clearAllMocks();
});

function renderWithToken(token: string | null) {
  const utils = render(<ResetPasswordForm token={token} />);
  return { ...utils, form: utils.container.querySelector("form") };
}

describe("ResetPasswordForm", () => {
  it("shows an expired-link message and no form when the token is missing", () => {
    const { form } = renderWithToken(null);
    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(form).toBeNull();
  });

  it("resets the password and routes to sign-in on success", async () => {
    resetPassword.mockResolvedValue({ error: null });
    const { form } = renderWithToken("tok-123");
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "supersecret" } });
    fireEvent.submit(form!);

    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith({ newPassword: "supersecret", token: "tok-123" }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/sign-in"));
    expect(toast.success).toHaveBeenCalled();
  });

  it("blocks a too-short password before calling the API", () => {
    const { form } = renderWithToken("tok-123");
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "short" } });
    fireEvent.submit(form!);
    expect(resetPassword).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("surfaces a reset error and does not navigate", async () => {
    resetPassword.mockResolvedValue({ error: { message: "Token expired." } });
    const { form } = renderWithToken("tok-123");
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "supersecret" } });
    fireEvent.submit(form!);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Token expired."));
    expect(push).not.toHaveBeenCalled();
  });
});

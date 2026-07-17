// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { requestPasswordReset, toast } = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/auth/client", () => ({ authClient: { requestPasswordReset } }));
vi.mock("sonner", () => ({ toast }));

import { ForgotPasswordForm } from "./forgot-password-form";

afterEach(() => {
  vi.clearAllMocks();
});

function renderForm() {
  const utils = render(<ForgotPasswordForm />);
  return { ...utils, form: utils.container.querySelector("form")! };
}

describe("ForgotPasswordForm", () => {
  it("renders an email field", () => {
    renderForm();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("requests a reset and shows the neutral confirmation", async () => {
    requestPasswordReset.mockResolvedValue({});
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.submit(form);

    await waitFor(() =>
      expect(requestPasswordReset).toHaveBeenCalledWith({
        email: "ada@example.com",
        redirectTo: "/reset-password",
      }),
    );
    expect(toast.success).toHaveBeenCalled();
    // The form is replaced by a neutral "check your inbox" message (no account-existence leak).
    await waitFor(() => expect(screen.getByText(/check your inbox/i)).toBeInTheDocument());
  });

  it("blocks an invalid email", () => {
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "bad" } });
    fireEvent.submit(form);
    expect(requestPasswordReset).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });
});

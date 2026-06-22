// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { sendVerificationEmail, toast } = vi.hoisted(() => ({
  sendVerificationEmail: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/auth/client", () => ({ authClient: { sendVerificationEmail } }));
vi.mock("sonner", () => ({ toast }));

import { ResendVerificationForm } from "./resend-verification-form";

afterEach(() => {
  vi.clearAllMocks();
});

function renderForm() {
  const utils = render(<ResendVerificationForm />);
  return { ...utils, form: utils.container.querySelector("form")! };
}

describe("ResendVerificationForm", () => {
  it("renders an email field", () => {
    renderForm();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("resends verification and shows the neutral confirmation", async () => {
    sendVerificationEmail.mockResolvedValue({});
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.submit(form);

    await waitFor(() =>
      expect(sendVerificationEmail).toHaveBeenCalledWith({
        email: "ada@example.com",
        callbackURL: "/",
      }),
    );
    expect(toast.success).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(/check your inbox/i)).toBeInTheDocument());
  });

  it("blocks an invalid email", () => {
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "bad" } });
    fireEvent.submit(form);
    expect(sendVerificationEmail).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });
});

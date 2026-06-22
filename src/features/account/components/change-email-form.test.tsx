// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { changeEmail, toast } = vi.hoisted(() => ({
  changeEmail: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/auth/client", () => ({ authClient: { changeEmail } }));
vi.mock("sonner", () => ({ toast }));

import { ChangeEmailForm } from "./change-email-form";

afterEach(() => {
  vi.clearAllMocks();
});

function renderForm(currentEmail = "ada@old.com") {
  const utils = render(<ChangeEmailForm currentEmail={currentEmail} />);
  return { ...utils, form: utils.container.querySelector("form")! };
}

describe("ChangeEmailForm", () => {
  it("shows the current email and a new-email field", () => {
    renderForm("ada@old.com");
    expect(screen.getByLabelText("Current email")).toHaveValue("ada@old.com");
    expect(screen.getByLabelText("New email")).toBeInTheDocument();
  });

  it("starts an email change on success", async () => {
    changeEmail.mockResolvedValue({ error: null });
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText("New email"), { target: { value: "ada@new.com" } });
    fireEvent.submit(form);

    await waitFor(() =>
      expect(changeEmail).toHaveBeenCalledWith({
        newEmail: "ada@new.com",
        callbackURL: "/settings",
      }),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it("rejects re-entering the current email without calling the API", () => {
    const { form } = renderForm("ada@old.com");
    fireEvent.change(screen.getByLabelText("New email"), { target: { value: "ada@old.com" } });
    fireEvent.submit(form);
    expect(changeEmail).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("That's already your email address.");
  });

  it("blocks an invalid new email", () => {
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText("New email"), { target: { value: "nope" } });
    fireEvent.submit(form);
    expect(changeEmail).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("surfaces an API error", async () => {
    changeEmail.mockResolvedValue({ error: { message: "Email already in use." } });
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText("New email"), { target: { value: "ada@new.com" } });
    fireEvent.submit(form);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Email already in use."));
  });
});

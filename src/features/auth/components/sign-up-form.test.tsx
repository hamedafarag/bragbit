// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { push, signUpEmail, toast } = vi.hoisted(() => ({
  push: vi.fn(),
  signUpEmail: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/auth/client", () => ({ authClient: { signUp: { email: signUpEmail } } }));
vi.mock("sonner", () => ({ toast }));

import { SignUpForm } from "./sign-up-form";

afterEach(() => {
  vi.clearAllMocks();
});

function renderForm() {
  const utils = render(<SignUpForm />);
  return { ...utils, form: utils.container.querySelector("form")! };
}

function fill(over: Partial<{ name: string; email: string; password: string }> = {}) {
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: over.name ?? "Ada Lovelace" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: over.email ?? "ada@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: over.password ?? "supersecret" },
  });
}

describe("SignUpForm", () => {
  it("renders name, email, and password fields", () => {
    renderForm();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("signs up and routes to verify-email on success", async () => {
    signUpEmail.mockResolvedValue({ error: null });
    const { form } = renderForm();
    fill();
    fireEvent.submit(form);

    await waitFor(() =>
      expect(signUpEmail).toHaveBeenCalledWith({
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "supersecret",
      }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/verify-email"));
    expect(toast.success).toHaveBeenCalled();
  });

  it("blocks an invalid submission (short password) before calling the API", () => {
    const { form } = renderForm();
    fill({ password: "short" });
    fireEvent.submit(form);
    expect(signUpEmail).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("surfaces a sign-up error and does not navigate", async () => {
    signUpEmail.mockResolvedValue({ error: { message: "Email already in use." } });
    const { form } = renderForm();
    fill();
    fireEvent.submit(form);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Email already in use."));
    expect(push).not.toHaveBeenCalled();
  });
});

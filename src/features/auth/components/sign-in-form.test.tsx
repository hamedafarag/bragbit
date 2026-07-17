// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { push, refresh, signInEmail, toast } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  signInEmail: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/lib/auth/client", () => ({ authClient: { signIn: { email: signInEmail } } }));
vi.mock("sonner", () => ({ toast }));

import { SignInForm } from "./sign-in-form";

afterEach(() => {
  vi.clearAllMocks();
});

function renderForm() {
  const utils = render(<SignInForm />);
  return { ...utils, form: utils.container.querySelector("form")! };
}

function fill(over: Partial<{ email: string; password: string }> = {}) {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: over.email ?? "ada@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: over.password ?? "supersecret" },
  });
}

describe("SignInForm", () => {
  it("renders email and password fields", () => {
    renderForm();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("signs in and routes to the dashboard on success", async () => {
    signInEmail.mockResolvedValue({ error: null });
    const { form } = renderForm();
    fill();
    fireEvent.submit(form);

    await waitFor(() =>
      expect(signInEmail).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "supersecret",
      }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(refresh).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it("blocks an invalid email before calling the API", () => {
    const { form } = renderForm();
    fill({ email: "not-an-email" });
    fireEvent.submit(form);
    expect(signInEmail).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("surfaces a sign-in error and does not navigate", async () => {
    signInEmail.mockResolvedValue({ error: { message: "Invalid credentials." } });
    const { form } = renderForm();
    fill();
    fireEvent.submit(form);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Invalid credentials."));
    expect(push).not.toHaveBeenCalled();
  });
});

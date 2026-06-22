// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { push, refresh, registerInvitee, acceptInvitation, toast } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  registerInvitee: vi.fn(),
  acceptInvitation: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("../actions", () => ({ registerInvitee, acceptInvitation }));
vi.mock("sonner", () => ({ toast }));

import { AcceptForm } from "./accept-form";

afterEach(() => {
  vi.clearAllMocks();
});

function renderForm() {
  const utils = render(
    <AcceptForm invitationId="inv-1" email="ada@acme.com" organizationName="Acme" />,
  );
  return { ...utils, form: utils.container.querySelector("form")! };
}

function fill(over: Partial<{ name: string; password: string }> = {}) {
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: over.name ?? "Ada" } });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: over.password ?? "supersecret" },
  });
}

describe("AcceptForm", () => {
  it("shows the fixed invite email and a name + password field", () => {
    renderForm();
    expect(screen.getByLabelText("Email")).toHaveValue("ada@acme.com");
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("registers, accepts, and routes to the dashboard on success", async () => {
    registerInvitee.mockResolvedValue({ ok: true });
    acceptInvitation.mockResolvedValue({ ok: true });
    const { form } = renderForm();
    fill();
    fireEvent.submit(form);

    await waitFor(() =>
      expect(registerInvitee).toHaveBeenCalledWith("inv-1", {
        name: "Ada",
        password: "supersecret",
      }),
    );
    await waitFor(() => expect(acceptInvitation).toHaveBeenCalledWith("inv-1"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(toast.success).toHaveBeenCalled();
  });

  it("stops at registration failure without accepting", async () => {
    registerInvitee.mockResolvedValue({ ok: false, error: "Email already in use." });
    const { form } = renderForm();
    fill();
    fireEvent.submit(form);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Email already in use."));
    expect(acceptInvitation).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("surfaces an acceptance failure", async () => {
    registerInvitee.mockResolvedValue({ ok: true });
    acceptInvitation.mockResolvedValue({ ok: false, error: "Invitation expired." });
    const { form } = renderForm();
    fill();
    fireEvent.submit(form);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Invitation expired."));
    expect(push).not.toHaveBeenCalled();
  });

  it("blocks a too-short password before registering", () => {
    const { form } = renderForm();
    fill({ password: "short" });
    fireEvent.submit(form);
    expect(registerInvitee).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });
});

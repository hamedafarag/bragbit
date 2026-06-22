// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { refresh, inviteMembers, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  inviteMembers: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../actions", () => ({ inviteMembers }));
vi.mock("sonner", () => ({ toast }));

import { InviteForm } from "./invite-form";

afterEach(() => {
  vi.clearAllMocks();
});

function renderForm() {
  const utils = render(<InviteForm />);
  return { ...utils, form: utils.container.querySelector("form")! };
}

function setEmails(value: string) {
  fireEvent.change(screen.getByLabelText("Email addresses"), { target: { value } });
}

describe("InviteForm", () => {
  it("renders the emails field and a role selector", () => {
    renderForm();
    expect(screen.getByLabelText("Email addresses")).toBeInTheDocument();
    expect(screen.getByLabelText("Role")).toBeInTheDocument();
  });

  it("parses and de-duplicates emails, then invites on success", async () => {
    inviteMembers.mockResolvedValue({ ok: true, invited: 2, failures: [] });
    const { form } = renderForm();
    setEmails("ada@x.com, grace@x.com ada@x.com");
    fireEvent.submit(form);

    await waitFor(() =>
      expect(inviteMembers).toHaveBeenCalledWith({
        emails: ["ada@x.com", "grace@x.com"],
        role: "member",
      }),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it("warns on a partial success", async () => {
    inviteMembers.mockResolvedValue({
      ok: true,
      invited: 1,
      failures: [{ email: "grace@x.com", error: "already a member" }],
    });
    const { form } = renderForm();
    setEmails("ada@x.com, grace@x.com");
    fireEvent.submit(form);
    await waitFor(() => expect(toast.warning).toHaveBeenCalled());
  });

  it("errors when every invite fails", async () => {
    inviteMembers.mockResolvedValue({
      ok: true,
      invited: 0,
      failures: [{ email: "ada@x.com", error: "already a member" }],
    });
    const { form } = renderForm();
    setEmails("ada@x.com");
    fireEvent.submit(form);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it("surfaces an action-level error", async () => {
    inviteMembers.mockResolvedValue({ ok: false, error: "Rate limited." });
    const { form } = renderForm();
    setEmails("ada@x.com");
    fireEvent.submit(form);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Rate limited."));
  });

  it("blocks a submission with no valid emails", () => {
    const { form } = renderForm();
    setEmails("   ");
    fireEvent.submit(form);
    expect(inviteMembers).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });
});

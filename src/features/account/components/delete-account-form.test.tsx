// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { deleteUser, toast } = vi.hoisted(() => ({
  deleteUser: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/auth/client", () => ({ authClient: { deleteUser } }));
vi.mock("sonner", () => ({ toast }));
// Render the dialog inline so the confirm form is testable without Radix's portal.
vi.mock("@/components/ui/dialog", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Dialog: Pass,
    DialogTrigger: Pass,
    DialogContent: Pass,
    DialogHeader: Pass,
    DialogTitle: Pass,
    DialogDescription: Pass,
    DialogFooter: Pass,
    DialogClose: Pass,
  };
});

import { DeleteAccountForm } from "./delete-account-form";

beforeEach(() => {
  // jsdom doesn't implement navigation; capture the success redirect instead.
  Object.defineProperty(window, "location", { configurable: true, value: { href: "" } });
});

afterEach(() => {
  vi.clearAllMocks();
});

function renderForm(isSoloOwner = false) {
  const utils = render(<DeleteAccountForm isSoloOwner={isSoloOwner} />);
  return { ...utils, form: utils.container.querySelector("form")! };
}

describe("DeleteAccountForm", () => {
  it("warns the workspace is deleted for a solo owner", () => {
    renderForm(true);
    expect(screen.getByText(/workspace is deleted with it/i)).toBeInTheDocument();
  });

  it("deletes the account and redirects on success", async () => {
    deleteUser.mockResolvedValue({ error: null });
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText("Confirm your password"), {
      target: { value: "supersecret" },
    });
    fireEvent.submit(form);

    await waitFor(() => expect(deleteUser).toHaveBeenCalledWith({ password: "supersecret" }));
    expect(toast.success).toHaveBeenCalled();
    await waitFor(() => expect(window.location.href).toBe("/"));
  });

  it("blocks submitting without a password", () => {
    const { form } = renderForm();
    fireEvent.submit(form);
    expect(deleteUser).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("surfaces an API error and does not redirect", async () => {
    deleteUser.mockResolvedValue({ error: { message: "Wrong password." } });
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText("Confirm your password"), {
      target: { value: "supersecret" },
    });
    fireEvent.submit(form);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Wrong password."));
    expect(window.location.href).toBe("");
  });
});

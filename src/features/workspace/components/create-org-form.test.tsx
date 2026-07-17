// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { push, refresh, createOrg, toast } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  createOrg: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("../actions", () => ({ createOrganizationWorkspace: createOrg }));
vi.mock("sonner", () => ({ toast }));

import { CreateOrgForm } from "./create-org-form";

afterEach(() => {
  vi.clearAllMocks();
});

function renderForm() {
  const utils = render(<CreateOrgForm />);
  return { ...utils, form: utils.container.querySelector("form")! };
}

describe("CreateOrgForm", () => {
  it("renders the name field and submit button", () => {
    renderForm();
    expect(screen.getByLabelText("Organization name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create organization/i })).toBeInTheDocument();
  });

  it("creates an org and routes to the dashboard on success", async () => {
    createOrg.mockResolvedValue({ ok: true, id: "org-1" });
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText("Organization name"), {
      target: { value: "Acme Corp" },
    });
    fireEvent.submit(form);

    await waitFor(() => expect(createOrg).toHaveBeenCalledWith({ name: "Acme Corp" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(toast.success).toHaveBeenCalled();
  });

  it("does not submit an empty name", () => {
    const { form } = renderForm();
    fireEvent.submit(form);
    expect(createOrg).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("surfaces the action error and does not navigate", async () => {
    createOrg.mockResolvedValue({
      ok: false,
      error: "Couldn't create the organization. Try again.",
    });
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText("Organization name"), { target: { value: "Acme" } });
    fireEvent.submit(form);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't create the organization. Try again."),
    );
    expect(push).not.toHaveBeenCalled();
  });
});

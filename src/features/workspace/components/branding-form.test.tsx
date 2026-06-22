// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { refresh, updateWorkspaceBranding, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  updateWorkspaceBranding: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../actions", () => ({ updateWorkspaceBranding }));
vi.mock("sonner", () => ({ toast }));

import { BrandingForm } from "./branding-form";

afterEach(() => {
  vi.clearAllMocks();
});

function renderForm(initial = { name: "Acme", accentColor: "#0f766e" }) {
  const utils = render(<BrandingForm initial={initial} />);
  return { ...utils, form: utils.container.querySelector("form")! };
}

describe("BrandingForm", () => {
  it("renders the name field and accent inputs", () => {
    renderForm();
    expect(screen.getByLabelText("Workspace name")).toHaveValue("Acme");
    expect(screen.getByLabelText("Accent hex")).toHaveValue("#0f766e");
  });

  it("saves the branding on success", async () => {
    updateWorkspaceBranding.mockResolvedValue({ ok: true });
    const { form } = renderForm();
    fireEvent.submit(form);
    await waitFor(() =>
      expect(updateWorkspaceBranding).toHaveBeenCalledWith({
        name: "Acme",
        accentColor: "#0f766e",
      }),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it("applies a preset swatch to the hex field", () => {
    renderForm();
    fireEvent.click(screen.getByLabelText("Accent #e8590c"));
    expect(screen.getByLabelText("Accent hex")).toHaveValue("#e8590c");
  });

  it("blocks an invalid accent color", () => {
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText("Accent hex"), { target: { value: "nothex" } });
    fireEvent.submit(form);
    expect(updateWorkspaceBranding).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("surfaces an action error", async () => {
    updateWorkspaceBranding.mockResolvedValue({ ok: false, error: "Could not save." });
    const { form } = renderForm();
    fireEvent.submit(form);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not save."));
  });
});

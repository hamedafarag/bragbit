// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { refresh, updateProfile, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  updateProfile: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../actions", () => ({ updateProfile }));
vi.mock("sonner", () => ({ toast }));

import { ProfileForm, type ProfileFormValues } from "./profile-form";

const INITIAL: ProfileFormValues = {
  displayName: "Ada Lovelace",
  roleTitle: "Engineer",
  team: "Core",
  bio: "Builds things.",
};

afterEach(() => {
  vi.clearAllMocks();
});

function renderForm(initial: ProfileFormValues = INITIAL) {
  const utils = render(<ProfileForm initial={initial} />);
  return { ...utils, form: utils.container.querySelector("form")! };
}

describe("ProfileForm", () => {
  it("renders the fields populated from initial values", () => {
    renderForm();
    expect(screen.getByLabelText("Display name")).toHaveValue("Ada Lovelace");
    expect(screen.getByLabelText("Role title")).toHaveValue("Engineer");
    expect(screen.getByLabelText("Bio")).toHaveValue("Builds things.");
  });

  it("saves the profile on success", async () => {
    updateProfile.mockResolvedValue({ ok: true });
    const { form } = renderForm();
    fireEvent.submit(form);

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({
        displayName: "Ada Lovelace",
        roleTitle: "Engineer",
        team: "Core",
        bio: "Builds things.",
      }),
    );
    expect(toast.success).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("surfaces an action error", async () => {
    updateProfile.mockResolvedValue({ ok: false, error: "Could not save." });
    const { form } = renderForm();
    fireEvent.submit(form);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not save."));
  });

  it("blocks an empty display name before calling the action", () => {
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "" } });
    fireEvent.submit(form);
    expect(updateProfile).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });
});

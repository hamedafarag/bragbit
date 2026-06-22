// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { refresh, updateReminderSettings, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  updateReminderSettings: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../actions", () => ({ updateReminderSettings }));
vi.mock("sonner", () => ({ toast }));

import { ReminderSettingsForm, type ReminderFormValues } from "./reminder-settings-form";

const INITIAL: ReminderFormValues = { enabled: true, day: 3, timezone: "America/New_York" };

afterEach(() => {
  vi.clearAllMocks();
});

function save() {
  fireEvent.click(screen.getByRole("button", { name: /save reminder settings/i }));
}

describe("ReminderSettingsForm", () => {
  it("renders the toggle and save button reflecting the saved settings", () => {
    render(<ReminderSettingsForm initial={INITIAL} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByRole("button", { name: /save reminder settings/i })).toBeInTheDocument();
  });

  it("saves the current preferences on success", async () => {
    updateReminderSettings.mockResolvedValue({ ok: true });
    render(<ReminderSettingsForm initial={INITIAL} />);
    save();

    await waitFor(() =>
      expect(updateReminderSettings).toHaveBeenCalledWith({
        enabled: true,
        day: 3,
        timezone: "America/New_York",
      }),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it("carries the toggle state into the saved payload", async () => {
    updateReminderSettings.mockResolvedValue({ ok: true });
    render(<ReminderSettingsForm initial={INITIAL} />);
    fireEvent.click(screen.getByRole("checkbox")); // turn off
    save();
    await waitFor(() =>
      expect(updateReminderSettings).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false }),
      ),
    );
  });

  it("surfaces an action error", async () => {
    updateReminderSettings.mockResolvedValue({ ok: false, error: "Could not save." });
    render(<ReminderSettingsForm initial={INITIAL} />);
    save();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not save."));
  });
});

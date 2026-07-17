// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { push, refresh, completeSetup, toast } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  completeSetup: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("../actions", () => ({ completeSetup }));
vi.mock("sonner", () => ({ toast }));

import { SetupForm } from "./setup-form";

afterEach(() => {
  vi.clearAllMocks();
});

function renderForm(
  props: { mode?: "private-org" | "private-solo"; requiresToken?: boolean } = {},
) {
  const utils = render(
    <SetupForm mode={props.mode ?? "private-solo"} requiresToken={props.requiresToken ?? false} />,
  );
  return { ...utils, form: utils.container.querySelector("form")! };
}

function fill(over: Partial<{ email: string }> = {}) {
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: over.email ?? "ada@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "supersecret" } });
}

describe("SetupForm", () => {
  it("labels the workspace for solo mode", () => {
    renderForm({ mode: "private-solo" });
    expect(screen.getByLabelText("Workspace name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create workspace" })).toBeInTheDocument();
  });

  it("labels the workspace for org mode", () => {
    renderForm({ mode: "private-org" });
    expect(screen.getByLabelText("Organization name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create organization" })).toBeInTheDocument();
  });

  it("shows the setup-token field only when required", () => {
    const { rerender } = render(<SetupForm mode="private-solo" requiresToken={false} />);
    expect(screen.queryByLabelText("Setup token")).toBeNull();
    rerender(<SetupForm mode="private-solo" requiresToken />);
    expect(screen.getByLabelText("Setup token")).toBeInTheDocument();
  });

  it("creates the workspace and routes to the dashboard on success", async () => {
    completeSetup.mockResolvedValue({ ok: true });
    const { form } = renderForm({ mode: "private-solo" });
    fill();
    fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "My Logbook" } });
    fireEvent.submit(form);

    await waitFor(() =>
      expect(completeSetup).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Ada",
          email: "ada@example.com",
          password: "supersecret",
          workspaceName: "My Logbook",
        }),
      ),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(toast.success).toHaveBeenCalled();
  });

  it("blocks an invalid email before calling the action", () => {
    const { form } = renderForm();
    fill({ email: "bad" });
    fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "WS" } });
    fireEvent.submit(form);
    expect(completeSetup).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("surfaces a setup error", async () => {
    completeSetup.mockResolvedValue({ ok: false, error: "Setup already done." });
    const { form } = renderForm();
    fill();
    fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "WS" } });
    fireEvent.submit(form);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Setup already done."));
  });
});

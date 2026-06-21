// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen } from "@/test/dom";

import { SharePasswordPanel } from "./share-password-panel";

const base = {
  pw: "",
  onPwChange: () => {},
  pending: false,
  onSet: () => {},
  onRemove: () => {},
};

describe("SharePasswordPanel", () => {
  it("shows the unprotected state and disables Set for a short password", () => {
    render(<SharePasswordPanel {...base} hasPassword={false} pw="123" />);
    expect(screen.getByText("Anyone with the link can view")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set" })).toBeDisabled();
    expect(screen.getByText("At least 6 characters.")).toBeInTheDocument();
  });

  it("enables Set once the password is long enough", () => {
    render(<SharePasswordPanel {...base} hasPassword={false} pw="longenough" />);
    expect(screen.getByRole("button", { name: "Set" })).toBeEnabled();
  });

  it("shows the protected state with Update + Remove, and relays Remove", () => {
    const onRemove = vi.fn();
    render(<SharePasswordPanel {...base} hasPassword={true} pw="longenough" onRemove={onRemove} />);
    expect(screen.getByText("Protected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove password" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("relays typing through onPwChange", () => {
    const onPwChange = vi.fn();
    render(<SharePasswordPanel {...base} hasPassword={false} onPwChange={onPwChange} />);
    fireEvent.change(screen.getByLabelText("Share password"), { target: { value: "secret1" } });
    expect(onPwChange).toHaveBeenCalledWith("secret1");
  });
});

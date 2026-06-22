// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { refresh, changeMemberRole, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  changeMemberRole: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../actions", () => ({ changeMemberRole }));
vi.mock("sonner", () => ({ toast }));

import { MemberRoleSelect } from "./member-role-select";

afterEach(() => {
  vi.clearAllMocks();
});

describe("MemberRoleSelect", () => {
  it("renders the role options", () => {
    render(<MemberRoleSelect memberId="m1" role="member" />);
    const select = screen.getByLabelText("Member role");
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Member" })).toBeInTheDocument();
  });

  it("changes the role on a new selection", async () => {
    changeMemberRole.mockResolvedValue({ ok: true });
    render(<MemberRoleSelect memberId="m1" role="member" />);
    fireEvent.change(screen.getByLabelText("Member role"), { target: { value: "admin" } });

    await waitFor(() => expect(changeMemberRole).toHaveBeenCalledWith("m1", "admin"));
    expect(toast.success).toHaveBeenCalled();
  });

  it("does nothing when the role is unchanged", () => {
    render(<MemberRoleSelect memberId="m1" role="member" />);
    fireEvent.change(screen.getByLabelText("Member role"), { target: { value: "member" } });
    expect(changeMemberRole).not.toHaveBeenCalled();
  });

  it("surfaces an error and reverts the selection", async () => {
    changeMemberRole.mockResolvedValue({ ok: false, error: "Not allowed." });
    render(<MemberRoleSelect memberId="m1" role="member" />);
    fireEvent.change(screen.getByLabelText("Member role"), { target: { value: "admin" } });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Not allowed."));
  });
});

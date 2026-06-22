// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { refresh, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast }));

import { AvatarUploader } from "./avatar-uploader";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function setup(props: { avatarUrl?: string | null; initials?: string } = {}) {
  const utils = render(
    <AvatarUploader avatarUrl={props.avatarUrl ?? null} initials={props.initials ?? "AL"} />,
  );
  return {
    ...utils,
    input: utils.container.querySelector('input[type="file"]') as HTMLInputElement,
  };
}
const pick = (input: HTMLInputElement) =>
  fireEvent.change(input, {
    target: { files: [new File([new Uint8Array(4)], "me.png", { type: "image/png" })] },
  });

describe("AvatarUploader", () => {
  it("shows initials when there is no avatar", () => {
    setup({ avatarUrl: null, initials: "AL" });
    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("shows the avatar image when set", () => {
    setup({ avatarUrl: "/api/files/ws/avatars/a.png" });
    expect(screen.getByAltText("Your avatar")).toBeInTheDocument();
  });

  it("uploads a picked file", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const { input } = setup();
    pick(input);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/upload/avatar",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(toast.success).toHaveBeenCalledWith("Avatar updated.");
  });

  it("surfaces an upload error", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Too big." }) });
    const { input } = setup();
    pick(input);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Too big."));
  });

  it("does nothing when no file is picked", () => {
    const { input } = setup();
    fireEvent.change(input, { target: { files: [] } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

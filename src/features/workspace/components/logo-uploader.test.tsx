// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

const { refresh, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast }));

import { LogoUploader } from "./logo-uploader";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function setup(props: { logoUrl?: string | null; workspaceName?: string } = {}) {
  const utils = render(
    <LogoUploader logoUrl={props.logoUrl ?? null} workspaceName={props.workspaceName ?? "Acme"} />,
  );
  return {
    ...utils,
    input: utils.container.querySelector('input[type="file"]') as HTMLInputElement,
  };
}
const pick = (input: HTMLInputElement) =>
  fireEvent.change(input, {
    target: { files: [new File([new Uint8Array(4)], "logo.png", { type: "image/png" })] },
  });

describe("LogoUploader", () => {
  it("shows the workspace initial when there is no logo", () => {
    setup({ logoUrl: null, workspaceName: "Acme" });
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("shows the logo image when set", () => {
    setup({ logoUrl: "/api/files/ws/branding/logo.png", workspaceName: "Acme" });
    expect(screen.getByAltText("Acme logo")).toBeInTheDocument();
  });

  it("uploads a picked file", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const { input } = setup();
    pick(input);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/upload/logo",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(toast.success).toHaveBeenCalledWith("Logo updated.");
  });

  it("surfaces an upload error", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Wrong type." }) });
    const { input } = setup();
    pick(input);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Wrong type."));
  });

  it("does nothing when no file is picked", () => {
    const { input } = setup();
    fireEvent.change(input, { target: { files: [] } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@/test/dom";

// Shared, assertable mocks (hoisted so the vi.mock factories can close over them).
const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
const toastFns = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const actions = vi.hoisted(() => ({
  connectPat: vi.fn(async () => ({ ok: true }) as { ok: boolean; error?: string }),
  importNow: vi.fn(
    async () => ({ ok: true, imported: 0 }) as { ok: boolean; imported?: number; error?: string },
  ),
  disconnectProvider: vi.fn(async () => ({ ok: true }) as { ok: boolean; error?: string }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: nav.refresh }) }));
vi.mock("sonner", () => ({ toast: toastFns }));
vi.mock("../actions", () => actions);

import { IntegrationCards, type ProviderCardData } from "./integration-cards";

const notConnected: ProviderCardData[] = [
  { id: "github", label: "GitHub", supportsPat: true, oauthConfigured: false, connection: null },
];
const connected: ProviderCardData[] = [
  {
    id: "github",
    label: "GitHub",
    supportsPat: true,
    oauthConfigured: false,
    connection: { authType: "pat", externalAccountLabel: "octocat", lastSyncedAt: null },
  },
];
const linear: ProviderCardData[] = [
  { id: "linear", label: "Linear", supportsPat: true, oauthConfigured: true, connection: null },
];

beforeEach(() => vi.clearAllMocks());

describe("IntegrationCards — rendering", () => {
  it("shows the connect form when not connected", () => {
    render(<IntegrationCards cards={notConnected} />);
    expect(screen.getByText("Not connected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
    expect(screen.getByLabelText("GitHub personal access token")).toBeInTheDocument();
  });

  it("shows the account and import/disconnect actions when connected", () => {
    render(<IntegrationCards cards={connected} />);
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("octocat")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import now" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
  });

  it("offers an OAuth connect button when the provider's OAuth app is configured", () => {
    render(<IntegrationCards cards={[{ ...notConnected[0]!, oauthConfigured: true }]} />);
    const link = screen.getByRole("link", { name: /Connect with GitHub/ }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/api/integrations/github/authorize");
    expect(screen.getByRole("button", { name: "Use a token" })).toBeInTheDocument();
  });

  it("renders a Linear card with provider-specific copy and the API-key field", () => {
    render(<IntegrationCards cards={linear} />);
    expect(screen.getByText("Linear")).toBeInTheDocument();
    // Linear-specific blurb + token noun (not the GitHub PR copy)
    expect(screen.getByText(/completed issues/)).toBeInTheDocument();
    expect(screen.getByLabelText("Linear API key")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Connect with Linear/ }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/api/integrations/linear/authorize");
  });
});

describe("IntegrationCards — connecting", () => {
  it("rejects an empty token client-side without calling the action", async () => {
    render(<IntegrationCards cards={notConnected} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await waitFor(() => expect(toastFns.error).toHaveBeenCalled());
    expect(actions.connectPat).not.toHaveBeenCalled();
    expect(nav.refresh).not.toHaveBeenCalled();
  });

  it("submits a pasted token, then toasts and refreshes on success", async () => {
    render(<IntegrationCards cards={notConnected} />);
    fireEvent.change(screen.getByLabelText("GitHub personal access token"), {
      target: { value: "ghp_token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() =>
      expect(actions.connectPat).toHaveBeenCalledWith({ provider: "github", token: "ghp_token" }),
    );
    expect(toastFns.success).toHaveBeenCalledWith("Connected GitHub.");
    expect(nav.refresh).toHaveBeenCalled();
  });

  it("surfaces a failed connect and does not refresh", async () => {
    actions.connectPat.mockResolvedValueOnce({ ok: false, error: "GitHub rejected that token." });
    render(<IntegrationCards cards={notConnected} />);
    fireEvent.change(screen.getByLabelText("GitHub personal access token"), {
      target: { value: "bad" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => expect(toastFns.error).toHaveBeenCalledWith("GitHub rejected that token."));
    expect(nav.refresh).not.toHaveBeenCalled();
  });
});

describe("IntegrationCards — connected actions", () => {
  it("Import now calls importNow and refreshes", async () => {
    actions.importNow.mockResolvedValueOnce({ ok: true, imported: 3 });
    render(<IntegrationCards cards={connected} />);
    fireEvent.click(screen.getByRole("button", { name: "Import now" }));

    await waitFor(() => expect(actions.importNow).toHaveBeenCalledWith("github"));
    expect(nav.refresh).toHaveBeenCalled();
  });

  it("Disconnect calls disconnectProvider and refreshes", async () => {
    render(<IntegrationCards cards={connected} />);
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));

    await waitFor(() => expect(actions.disconnectProvider).toHaveBeenCalledWith("github"));
    expect(toastFns.success).toHaveBeenCalledWith("Disconnected GitHub.");
    expect(nav.refresh).toHaveBeenCalled();
  });
});

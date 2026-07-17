// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test/dom";

// The card imports the server actions; stub them (and router/toast) so the client
// component renders in jsdom without pulling server-only modules.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../actions", () => ({
  connectPat: vi.fn(async () => ({ ok: true })),
  importNow: vi.fn(async () => ({ ok: true, imported: 0 })),
  disconnectProvider: vi.fn(async () => ({ ok: true })),
}));

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

describe("IntegrationCards", () => {
  it("shows the connect form when not connected", () => {
    render(<IntegrationCards cards={notConnected} />);
    expect(screen.getByText("Not connected")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect" })).toBeTruthy();
    expect(screen.getByLabelText("GitHub personal access token")).toBeTruthy();
  });

  it("shows the account and import/disconnect actions when connected", () => {
    render(<IntegrationCards cards={connected} />);
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.getByText("octocat")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Import now" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeTruthy();
  });

  it("offers an OAuth connect button when the provider's OAuth app is configured", () => {
    render(<IntegrationCards cards={[{ ...notConnected[0]!, oauthConfigured: true }]} />);
    const link = screen.getByRole("link", { name: /Connect with GitHub/ }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/api/integrations/github/authorize");
    // the token path is still offered, relabeled
    expect(screen.getByRole("button", { name: "Use a token" })).toBeTruthy();
  });
});

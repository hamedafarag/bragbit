// Unit tests for the MCP tool registration + handlers. The service layer is
// mocked, so these run without a DB and assert the handler wiring: the token's
// userId is extracted and passed through, results are formatted, and errors
// surface as isError.
import { describe, expect, it, vi } from "vitest";

vi.mock("./service", () => ({
  addBragForUser: vi.fn(),
  listDocumentsForUser: vi.fn(),
}));

import * as service from "./service";
import { registerMcpTools } from "./tools";

type Handler = (...args: unknown[]) => Promise<{ content: { text: string }[]; isError?: boolean }>;

/** A fake McpServer that captures tool registrations (both 3- and 4-arg forms). */
function fakeServer() {
  const tools: Record<string, { description: string; handler: Handler }> = {};
  const server = {
    tool: (name: string, description: string, a: unknown, b?: unknown) => {
      const handler = (typeof a === "function" ? a : b) as Handler;
      tools[name] = { description, handler };
    },
  };
  return { server, tools };
}

const extra = { authInfo: { token: "t", clientId: "c", scopes: [], extra: { userId: "u1" } } };

describe("registerMcpTools", () => {
  it("registers both tools; add_brag's description carries the BragBit formula", () => {
    const { server, tools } = fakeServer();
    registerMcpTools(server as never);
    expect(Object.keys(tools).sort()).toEqual(["bragbit_add_brag", "bragbit_list_documents"]);
    expect(tools.bragbit_add_brag.description).toContain(
      "what you did + why it mattered + the measurable result",
    );
  });

  it("add_brag scopes to the token's userId and returns the brag link", async () => {
    const { server, tools } = fakeServer();
    registerMcpTools(server as never);
    vi.mocked(service.addBragForUser).mockResolvedValue({
      ok: true,
      id: "b1",
      documentId: "d1",
      documentTitle: "2026 Wins",
      url: "http://x/documents/d1",
    });

    const res = await tools.bragbit_add_brag.handler({ title: "Win" }, extra);

    expect(service.addBragForUser).toHaveBeenCalledWith("u1", { title: "Win" });
    expect(res.content[0].text).toContain("2026 Wins");
    expect(res.content[0].text).toContain("http://x/documents/d1");
  });

  it("add_brag surfaces a service error as isError", async () => {
    const { server, tools } = fakeServer();
    registerMcpTools(server as never);
    vi.mocked(service.addBragForUser).mockResolvedValue({ ok: false, error: "no documents" });

    const res = await tools.bragbit_add_brag.handler({ title: "Win" }, extra);

    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe("no documents");
  });

  it("rejects a call whose token carries no userId", async () => {
    const { server, tools } = fakeServer();
    registerMcpTools(server as never);
    await expect(tools.bragbit_list_documents.handler({ authInfo: { extra: {} } })).rejects.toThrow(
      "Not authorized",
    );
  });

  it("list_documents formats the caller's documents", async () => {
    const { server, tools } = fakeServer();
    registerMcpTools(server as never);
    vi.mocked(service.listDocumentsForUser).mockResolvedValue([
      { id: "d1", title: "2026 Wins", workspaceName: "Acme", periodStart: null, periodEnd: null },
    ]);

    const res = await tools.bragbit_list_documents.handler(extra);

    expect(res.content[0].text).toContain("2026 Wins");
    expect(res.content[0].text).toContain("d1");
    expect(res.content[0].text).toContain("Acme");
  });

  it("list_documents handles the empty case", async () => {
    const { server, tools } = fakeServer();
    registerMcpTools(server as never);
    vi.mocked(service.listDocumentsForUser).mockResolvedValue([]);

    const res = await tools.bragbit_list_documents.handler(extra);

    expect(res.content[0].text).toContain("don't have any documents");
  });
});

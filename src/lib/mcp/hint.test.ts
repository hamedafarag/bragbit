import { describe, expect, it } from "vitest";

import { isMcpHintDismissed, MCP_HINT_COOKIE, mcpHintDismissCookie } from "./hint";

describe("mcp connector hint", () => {
  it("counts only the exact sentinel as dismissed", () => {
    expect(isMcpHintDismissed("dismissed")).toBe(true);
    expect(isMcpHintDismissed(undefined)).toBe(false);
    expect(isMcpHintDismissed("")).toBe(false);
    expect(isMcpHintDismissed("true")).toBe(false);
  });

  it("writes a cookie the server reads back as dismissed", () => {
    const cookie = mcpHintDismissCookie();
    expect(cookie).toContain(`${MCP_HINT_COOKIE}=dismissed`);
    expect(cookie).toContain("path=/");
    expect(cookie).toContain("samesite=lax");

    // Round-trip: the value the server would parse out of this cookie must mark
    // the hint dismissed — so the writer and the reader can't drift apart.
    const value = new RegExp(`${MCP_HINT_COOKIE}=([^;]+)`).exec(cookie)?.[1];
    expect(isMcpHintDismissed(value)).toBe(true);
  });
});

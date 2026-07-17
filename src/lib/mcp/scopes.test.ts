import { describe, expect, it } from "vitest";

import {
  describeScope,
  MCP_SCOPE_DESCRIPTIONS,
  MCP_SUPPORTED_SCOPES,
  MCP_TOOL_SCOPES,
} from "./scopes";

describe("mcp scopes", () => {
  it("advertises the OIDC identity scopes plus the two BragBit scopes", () => {
    expect(MCP_SUPPORTED_SCOPES).toEqual([
      "openid",
      "profile",
      "offline_access",
      "brags:write",
      "documents:read",
    ]);
  });

  it("every tool's required scope is one it advertises", () => {
    for (const scope of Object.values(MCP_TOOL_SCOPES)) {
      expect(MCP_SUPPORTED_SCOPES).toContain(scope);
    }
  });

  it("describeScope returns the friendly label, falling back to the raw scope", () => {
    expect(describeScope("brags:write")).toBe(MCP_SCOPE_DESCRIPTIONS["brags:write"]);
    expect(describeScope("openid")).toBe("Confirm your identity");
    expect(describeScope("something:unknown")).toBe("something:unknown");
  });
});

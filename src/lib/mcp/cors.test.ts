import { describe, expect, it } from "vitest";

import { mcpCorsPreflight, withMcpCors } from "./cors";

describe("mcp cors", () => {
  it("withMcpCors adds the connector CORS headers and returns the same response", () => {
    const res = new Response("hi", { status: 200 });
    const out = withMcpCors(res);

    expect(out).toBe(res); // mutates in place
    expect(out.headers.get("access-control-allow-origin")).toBe("*");
    expect(out.headers.get("access-control-allow-methods")).toContain("POST");
    expect(out.headers.get("access-control-allow-headers")).toContain("Authorization");
    expect(out.headers.get("access-control-expose-headers")).toContain("WWW-Authenticate");
  });

  it("mcpCorsPreflight answers a preflight with 204 + the CORS headers", () => {
    const res = mcpCorsPreflight();

    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-max-age")).toBe("86400");
  });
});

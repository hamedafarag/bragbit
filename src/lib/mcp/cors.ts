// CORS for the connector's browser-facing endpoints. Browser-based MCP clients
// (e.g. the MCP Inspector UI, web-hosted clients) run OAuth discovery + the token
// exchange from their own origin, and the MCP SDK tags those requests with an
// `MCP-Protocol-Version` header — which makes them "non-simple", so the browser
// sends an OPTIONS preflight first. The endpoints must answer that preflight and
// allow the cross-origin read. Auth is Bearer/PKCE (no cookies), so a wildcard
// origin is safe. Server-side clients (Claude Desktop, claude.ai) don't need any
// of this — it purely widens compatibility to browser clients.
const MCP_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, mcp-protocol-version, mcp-session-id",
  "Access-Control-Expose-Headers": "WWW-Authenticate, mcp-session-id",
  "Access-Control-Max-Age": "86400",
};

/** Add the connector CORS headers to a response (in place) and return it. */
export function withMcpCors<T extends Response>(res: T): T {
  for (const [key, value] of Object.entries(MCP_CORS_HEADERS)) res.headers.set(key, value);
  return res;
}

/** A 204 response answering a CORS preflight (OPTIONS) for a connector endpoint. */
export function mcpCorsPreflight(): Response {
  return new Response(null, { status: 204, headers: MCP_CORS_HEADERS });
}

import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createMcpHandler, withMcpAuth } from "mcp-handler";

import { registerMcpTools } from "@/features/mcp/tools";
import { auth } from "@/lib/auth";
import { mcpCorsPreflight, withMcpCors } from "@/lib/mcp/cors";
import { hitRateLimit } from "@/lib/rate-limit";

// The MCP connector endpoint (docs/specs/mcp-connector.md): a remote MCP server
// mounted in-app (no separate process), speaking the Streamable HTTP transport via
// mcp-handler. Auth is the OAuth 2.1 access token issued by the Better Auth mcp
// plugin; withMcpAuth validates it (getMcpSession) and injects the user onto the
// request, which the tools read to scope every query. Stateless — no Redis — true
// to "one docker compose up".

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Per-token request budget. Generous for interactive AI use. lib/rate-limit is
// in-process for the private modes and Postgres-backed on hosted (ENH-SEC-02), so
// the limit holds across instances there.
const MCP_RATE_LIMIT = 60;
const MCP_RATE_WINDOW_MS = 60_000;

/** Resolve a Bearer access token to the MCP AuthInfo (user + scopes), or undefined → 401. */
async function verifyToken(req: Request): Promise<AuthInfo | undefined> {
  const session = await auth.api.getMcpSession({ headers: req.headers });
  if (!session) return undefined;
  return {
    token: session.accessToken,
    clientId: session.clientId,
    scopes: session.scopes.split(" ").filter(Boolean),
    expiresAt: Math.floor(new Date(session.accessTokenExpiresAt).getTime() / 1000),
    // The user id the tools scope every query to.
    extra: { userId: session.userId },
  };
}

const mcpHandler = createMcpHandler(
  (server) => registerMcpTools(server),
  { serverInfo: { name: "BragBit", version: "1.0.0" } },
  { basePath: "/api", disableSse: true, maxDuration: 60 },
);

const handler = withMcpAuth(mcpHandler, verifyToken, { required: true });

/** The client's Bearer token, for per-token rate-limiting. */
function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
}

export async function POST(req: Request): Promise<Response> {
  const token = bearerToken(req);
  if (token) {
    const rl = await hitRateLimit(`mcp:${token}`, MCP_RATE_LIMIT, MCP_RATE_WINDOW_MS);
    if (!rl.ok) {
      return withMcpCors(
        Response.json(
          { jsonrpc: "2.0", error: { code: -32000, message: "Rate limit exceeded." }, id: null },
          { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
        ),
      );
    }
  }
  return withMcpCors(await handler(req));
}

// GET (SSE) and DELETE (session teardown) are unused in stateless mode; the
// handler answers them with a JSON-RPC 405. Wrapped so browser clients can read
// the response (and the 401's WWW-Authenticate challenge) cross-origin.
export async function GET(req: Request): Promise<Response> {
  return withMcpCors(await handler(req));
}

export async function DELETE(req: Request): Promise<Response> {
  return withMcpCors(await handler(req));
}

/** Answer the CORS preflight browser-based MCP clients send before POSTing. */
export function OPTIONS(): Response {
  return mcpCorsPreflight();
}

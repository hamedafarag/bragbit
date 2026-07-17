import { oAuthProtectedResourceMetadata } from "better-auth/plugins";

import { auth } from "@/lib/auth";
import { mcpCorsPreflight, withMcpCors } from "@/lib/mcp/cors";

// RFC 9728 — Protected Resource Metadata. The MCP endpoint (/api/mcp) is the
// protected resource; this tells a client which authorization server guards it
// and which scopes it supports, so the client knows where to send the user to
// authorize. Probed at the origin root before the OAuth flow begins. Browser
// clients preflight it (MCP-Protocol-Version header makes it non-simple), so we
// answer OPTIONS and keep the CORS headers on the GET.
export const dynamic = "force-dynamic";

const handler = oAuthProtectedResourceMetadata(auth);

export async function GET(request: Request): Promise<Response> {
  return withMcpCors(await handler(request));
}

export function OPTIONS(): Response {
  return mcpCorsPreflight();
}

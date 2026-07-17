import { oAuthDiscoveryMetadata } from "better-auth/plugins";

import { auth } from "@/lib/auth";
import { mcpCorsPreflight, withMcpCors } from "@/lib/mcp/cors";

// RFC 8414 — Authorization Server Metadata. MCP clients probe this at the origin
// root during the connect flow to discover the authorize / token / registration
// endpoints (which Better Auth's mcp plugin serves under /api/auth/mcp/*). The
// helper builds the document straight from the auth config. Browser clients
// preflight it (MCP-Protocol-Version header makes it non-simple), so we answer
// OPTIONS and keep the CORS headers on the GET.
export const dynamic = "force-dynamic";

const handler = oAuthDiscoveryMetadata(auth);

export async function GET(request: Request): Promise<Response> {
  return withMcpCors(await handler(request));
}

export function OPTIONS(): Response {
  return mcpCorsPreflight();
}

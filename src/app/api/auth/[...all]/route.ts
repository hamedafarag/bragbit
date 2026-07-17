import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";
import { isHosted } from "@/lib/instance";
import { mcpCorsPreflight, withMcpCors } from "@/lib/mcp/cors";

const handlers = toNextJsHandler(auth.handler);

/**
 * The MCP OAuth endpoints (/api/auth/mcp/token, /register) are called cross-origin
 * by browser-based clients, so their responses need CORS. The rest of Better Auth
 * is same-origin from the app and is left untouched.
 */
function isMcpAuthPath(req: Request): boolean {
  return new URL(req.url).pathname.startsWith("/api/auth/mcp/");
}

export async function GET(req: Request): Promise<Response> {
  const res = await handlers.GET(req);
  return isMcpAuthPath(req) ? withMcpCors(res) : res;
}

/**
 * Close the open email/password sign-up endpoint in the private (invitation-only)
 * modes (ENH-SEC-06). Accounts there are created only by the setup wizard and
 * invitation-accept, which call `auth.api.signUpEmail` directly — a server-side
 * call that never hits this HTTP route — so blocking the public path here leaves
 * the legitimate flows untouched. (The library's `emailAndPassword.disableSignUp`
 * can't be used: it lives inside the sign-up handler and would also block those
 * internal calls.) Hosted mode keeps open sign-up.
 */
export async function POST(req: Request): Promise<Response> {
  if (!isHosted() && new URL(req.url).pathname.endsWith("/sign-up/email")) {
    return Response.json(
      { code: "EMAIL_PASSWORD_SIGN_UP_DISABLED", message: "Public sign-up is disabled." },
      { status: 403 },
    );
  }
  const res = await handlers.POST(req);
  return isMcpAuthPath(req) ? withMcpCors(res) : res;
}

/** Answer the CORS preflight for the cross-origin MCP OAuth endpoints. */
export function OPTIONS(req: Request): Response {
  return isMcpAuthPath(req) ? mcpCorsPreflight() : new Response(null, { status: 204 });
}

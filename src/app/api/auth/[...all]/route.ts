import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";
import { isHosted } from "@/lib/instance";

const handlers = toNextJsHandler(auth.handler);

export const GET = handlers.GET;

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
  return handlers.POST(req);
}

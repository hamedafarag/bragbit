import { type NextRequest, NextResponse } from "next/server";

import { getProvider } from "@/features/integrations/providers";
import { OAUTH_STATE_COOKIE, upsertConnection } from "@/features/integrations/service";
import { getWorkspaceOrNull } from "@/lib/auth/guards";
import { env } from "@/lib/env";

// OAuth 2.0 callback (docs/specs/integrations.md, slice 1c). Verifies the CSRF
// state against the cookie, exchanges the code for a token, and stores the
// connection (encrypted) for the signed-in caller — then redirects back to
// Settings with a status the page flashes. The connection is bound to the current
// session's user + workspace, never anything from the redirect.

export async function GET(request: NextRequest) {
  const base = env.BETTER_AUTH_URL ?? env.APP_URL;
  const back = (status: string) => {
    const res = NextResponse.redirect(
      new URL(`/settings?integration=${status}#integrations`, base),
    );
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  };

  const access = await getWorkspaceOrNull();
  if (!access) return NextResponse.redirect(new URL("/sign-in", base));

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  // A GitHub-side error, a missing code, or a state/cookie mismatch → refuse (CSRF guard).
  if (url.searchParams.get("error") || !code || !state || !cookieState || state !== cookieState) {
    return back("github_failed");
  }

  try {
    const tokens = await getProvider("github").exchangeCode(code);
    await upsertConnection(access.user.id, access.workspaceId, "github", "oauth", tokens);
  } catch {
    return back("github_failed");
  }

  return back("github_connected");
}

import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { getProvider } from "@/features/integrations/providers";
import { OAUTH_STATE_COOKIE } from "@/features/integrations/service";
import { getWorkspaceOrNull } from "@/lib/auth/guards";
import { env } from "@/lib/env";

// OAuth 2.0 authorize step (docs/specs/integrations.md, slice 1c). Requires a
// session; mints a CSRF `state`, stashes it in a short-lived httpOnly cookie, and
// redirects the browser to GitHub. The callback verifies the returned state matches
// the cookie. Only available when the operator configured the OAuth app; otherwise
// the user falls back to the always-available PAT path.

export async function GET() {
  const base = env.BETTER_AUTH_URL ?? env.APP_URL;
  const access = await getWorkspaceOrNull();
  if (!access) return NextResponse.redirect(new URL("/sign-in", base));

  const github = getProvider("github");
  if (!github.oauthConfigured()) {
    return NextResponse.redirect(
      new URL("/settings?integration=github_unavailable#integrations", base),
    );
  }

  const state = randomBytes(16).toString("base64url");
  const res = NextResponse.redirect(github.authorizeUrl(state));
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax", // sent on the top-level redirect back from GitHub
    path: "/",
    maxAge: 600,
  });
  return res;
}

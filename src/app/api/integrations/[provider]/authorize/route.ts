import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { getProvider } from "@/features/integrations/providers";
import { providerSchema } from "@/features/integrations/schema";
import { oauthStateCookie } from "@/features/integrations/service";
import { getWorkspaceOrNull } from "@/lib/auth/guards";
import { env } from "@/lib/env";

// OAuth 2.0 authorize step (docs/specs/integrations.md). Generic over the `[provider]`
// segment (GitHub, Linear, …): requires a session; mints a CSRF `state`, stashes it in
// a short-lived per-provider httpOnly cookie, and redirects to the provider's consent
// screen. The callback verifies the returned state matches the cookie. Only available
// when the operator configured that provider's OAuth app; otherwise the user falls back
// to the always-available token-paste path.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const base = env.BETTER_AUTH_URL ?? env.APP_URL;

  const parsed = providerSchema.safeParse((await params).provider);
  if (!parsed.success) return NextResponse.redirect(new URL("/settings#integrations", base));
  const providerId = parsed.data;

  const access = await getWorkspaceOrNull();
  if (!access) return NextResponse.redirect(new URL("/sign-in", base));

  const provider = getProvider(providerId);
  if (!provider.oauthConfigured()) {
    return NextResponse.redirect(
      new URL(`/settings?integration=${providerId}_unavailable#integrations`, base),
    );
  }

  const state = randomBytes(16).toString("base64url");
  const res = NextResponse.redirect(provider.authorizeUrl(state));
  res.cookies.set(oauthStateCookie(providerId), state, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax", // sent on the top-level redirect back from the provider
    path: "/",
    maxAge: 600,
  });
  return res;
}

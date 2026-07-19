import { type NextRequest, NextResponse } from "next/server";

import { getProvider } from "@/features/integrations/providers";
import { providerSchema } from "@/features/integrations/schema";
import { oauthStateCookie, upsertConnection } from "@/features/integrations/service";
import { getWorkspaceOrNull } from "@/lib/auth/guards";
import { env } from "@/lib/env";

// OAuth 2.0 callback (docs/specs/integrations.md). Generic over the `[provider]`
// segment: verifies the CSRF state against the per-provider cookie, exchanges the code
// for tokens, and stores the connection (encrypted) for the signed-in caller — then
// redirects back to Settings with a status the page flashes. The connection is bound to
// the current session's user + workspace, never anything from the redirect.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const base = env.BETTER_AUTH_URL ?? env.APP_URL;

  const parsed = providerSchema.safeParse((await params).provider);
  if (!parsed.success) return NextResponse.redirect(new URL("/settings#integrations", base));
  const providerId = parsed.data;
  const cookieName = oauthStateCookie(providerId);

  const back = (status: string) => {
    const res = NextResponse.redirect(
      new URL(`/settings?integration=${status}#integrations`, base),
    );
    res.cookies.delete(cookieName);
    return res;
  };

  const access = await getWorkspaceOrNull();
  if (!access) return NextResponse.redirect(new URL("/sign-in", base));

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get(cookieName)?.value;

  // A provider-side error, a missing code, or a state/cookie mismatch → refuse (CSRF guard).
  if (url.searchParams.get("error") || !code || !state || !cookieState || state !== cookieState) {
    return back(`${providerId}_failed`);
  }

  try {
    const tokens = await getProvider(providerId).exchangeCode(code);
    await upsertConnection(access.user.id, access.workspaceId, providerId, "oauth", tokens);
  } catch {
    return back(`${providerId}_failed`);
  }

  return back(`${providerId}_connected`);
}

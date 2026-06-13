import { env } from "./env";

export type OAuthProvider = "github" | "google";

/**
 * Which social providers are configured (both id + secret present). The sign-in
 * page reads this on the server and passes it to the OAuth buttons, so a provider
 * only appears when the operator has actually set it up.
 */
export function configuredOAuthProviders(): OAuthProvider[] {
  const providers: OAuthProvider[] = [];
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) providers.push("github");
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) providers.push("google");
  return providers;
}

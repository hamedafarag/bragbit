import "server-only";

import { env } from "@/lib/env";

import type { ConnectionTokens, IntegrationProvider, RawCandidate } from "./types";

// GitHub adapter (docs/specs/integrations.md). v1 imports the user's merged pull
// requests. This slice (1a) wires up the metadata + config surface; the network
// calls (exchangeCode / validatePat / fetchCandidates) land in slice 1b.

/**
 * Requested OAuth scopes. `public_repo` is the safer default (public repos only);
 * an operator who wants private-repo PRs swaps in `repo`. `read:user` identifies
 * the connected account. Documented tradeoff in the spec.
 */
const OAUTH_SCOPES = "read:user public_repo";

/** The OAuth callback this adapter registers with GitHub. */
function redirectUri(): string {
  const base = env.BETTER_AUTH_URL ?? env.APP_URL;
  return `${base}/api/integrations/github/callback`;
}

/** Marker for the network methods filled in by slice 1b, so a mis-wire fails loudly. */
function notYetImplemented(method: string): never {
  throw new Error(`github.${method} is implemented in slice 1b`);
}

export const githubProvider: IntegrationProvider = {
  id: "github",
  label: "GitHub",
  supportsPat: true,

  oauthConfigured: () => Boolean(env.GITHUB_IMPORT_CLIENT_ID && env.GITHUB_IMPORT_CLIENT_SECRET),

  authorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: env.GITHUB_IMPORT_CLIENT_ID ?? "",
      redirect_uri: redirectUri(),
      scope: OAUTH_SCOPES,
      state,
      allow_signup: "false",
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  },

  // --- Network surface (slice 1b) ---
  exchangeCode: async (): Promise<ConnectionTokens> => notYetImplemented("exchangeCode"),
  validatePat: async (): Promise<ConnectionTokens> => notYetImplemented("validatePat"),
  fetchCandidates: async (): Promise<RawCandidate[]> => notYetImplemented("fetchCandidates"),
};

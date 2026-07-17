import type { Provider, SourceType } from "../schema";

// The provider-adapter contract (docs/specs/integrations.md §Architecture). Each
// provider (v1: GitHub) implements this; a registry (./index.ts) maps id → adapter
// and the settings UI renders only the ones that are reachable. The feature layer
// owns encryption, persistence, dedup and the DAL; an adapter only knows how to
// talk to its provider and normalize the results — no db access, no token storage.

/** Tokens + identity returned by an OAuth code exchange or a PAT validation. */
export type ConnectionTokens = {
  accessToken: string;
  refreshToken?: string;
  /** Absolute expiry; omit for non-expiring tokens (GitHub OAuth apps, PATs). */
  accessTokenExpiresAt?: Date;
  /** Space-delimited granted scopes, when the provider reports them. */
  scopes?: string;
  /** The connected account's provider id + a human label (e.g. GitHub login). */
  externalAccountId: string;
  externalAccountLabel: string;
  /** Provider extras to persist as JSON (e.g. Jira cloudId); shape is per-provider. */
  config?: Record<string, unknown>;
};

/** A connection decrypted and parsed for adapter use (never carries ciphertext). */
export type DecryptedConnection = {
  id: string;
  provider: Provider;
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: Date | null;
  config: Record<string, unknown> | null;
};

/** A normalized source item, ready to upsert as an import_candidate. */
export type RawCandidate = {
  externalId: string;
  externalUrl: string;
  sourceType: SourceType;
  title: string;
  /** When the work landed (e.g. PR merged_at); maps to the brag date on approve. */
  occurredAt: Date | null;
  /** Raw source subset to persist for editing on approve. */
  payload: Record<string, unknown>;
};

export type IntegrationProvider = {
  id: Provider;
  /** Display name for the settings card (e.g. "GitHub"). */
  label: string;
  /** Whether the OAuth "Connect" button is available (operator set env creds). */
  oauthConfigured: () => boolean;
  /** Whether this provider accepts a pasted personal-access-token (zero-config). */
  supportsPat: boolean;

  /** Build the provider authorize URL for the OAuth redirect; `state` is signed by the caller. */
  authorizeUrl: (state: string) => string;
  /** Exchange an OAuth callback code for tokens + identity. */
  exchangeCode: (code: string) => Promise<ConnectionTokens>;
  /** Validate a pasted PAT and resolve the account identity. */
  validatePat: (token: string) => Promise<ConnectionTokens>;
  /** Fetch normalized candidates newer than `since` (undefined = first import). */
  fetchCandidates: (conn: DecryptedConnection, since?: Date) => Promise<RawCandidate[]>;
};

/** Whether a provider is reachable at all (OAuth configured or PAT supported). */
export function isProviderAvailable(p: IntegrationProvider): boolean {
  return p.oauthConfigured() || p.supportsPat;
}

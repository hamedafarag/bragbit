import { z } from "zod";

// Shared vocabulary for the integrations feature (docs/specs/integrations.md).
// These mirror the free-form text columns in lib/db/schema/integration.ts and are
// validated here in app code. Adding a provider/source type here is the single gate
// that flows it through the registry, the Record<Provider,…> maps, and every zod
// validation — no DB migration (the columns are free-form text). Jira is the next
// extension point.

export const PROVIDER_VALUES = ["github", "linear"] as const;
export const providerSchema = z.enum(PROVIDER_VALUES);
export type Provider = (typeof PROVIDER_VALUES)[number];

/** How a connection was authorized: the OAuth flow, or a pasted personal-access-token. */
export const AUTH_TYPE_VALUES = ["oauth", "pat"] as const;
export const authTypeSchema = z.enum(AUTH_TYPE_VALUES);
export type AuthType = (typeof AUTH_TYPE_VALUES)[number];

/** A candidate's lifecycle in the review queue. */
export const CANDIDATE_STATUS_VALUES = ["pending", "approved", "dismissed"] as const;
export const candidateStatusSchema = z.enum(CANDIDATE_STATUS_VALUES);
export type CandidateStatus = (typeof CANDIDATE_STATUS_VALUES)[number];

/** What kind of source item a candidate came from (GitHub PRs, Linear issues). */
export const SOURCE_TYPE_VALUES = ["pull_request", "issue"] as const;
export const sourceTypeSchema = z.enum(SOURCE_TYPE_VALUES);
export type SourceType = (typeof SOURCE_TYPE_VALUES)[number];

// A pasted personal-access-token. Trimmed; bounded so an absurd input can't tie up
// the connect path (mirrors the share-password length guard). The exchange step
// validates it against the provider before anything is stored.
export const patConnectSchema = z.object({
  provider: providerSchema,
  token: z.string().trim().min(1, "Paste a token").max(500),
});
export type PatConnectInput = z.infer<typeof patConnectSchema>;

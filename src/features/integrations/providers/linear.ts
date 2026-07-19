import "server-only";

import { env } from "@/lib/env";

import type {
  ConnectionTokens,
  DecryptedConnection,
  IntegrationProvider,
  RawCandidate,
  RefreshedTokens,
} from "./types";

// Linear adapter (docs/specs/integrations.md). v1 imports the issues the connected
// user completed. Two connect paths resolve to the same encrypted connection: a
// pasted Personal API key (validatePat — keys don't expire, no operator app) and the
// OAuth code exchange (exchangeCode). Unlike GitHub, Linear OAuth tokens expire in
// ~24h and carry a refresh token, so this adapter also implements refreshTokens; the
// service layer persists the rotated token. All source calls go through Linear's
// single GraphQL endpoint — the auth header differs by path (OAuth is `Bearer <t>`,
// a Personal API key is the raw key), so fetchCandidates branches on conn.authType.

const GRAPHQL = "https://api.linear.app/graphql";
const OAUTH_AUTHORIZE = "https://linear.app/oauth/authorize";
const OAUTH_TOKEN = "https://api.linear.app/oauth/token";
const OAUTH_REVOKE = "https://api.linear.app/oauth/revoke";

/** `read` is the least-privilege scope and is always granted; we never request write. */
const OAUTH_SCOPES = "read";

/** One page of issues per import — bounded (mirrors the GitHub adapter's cap). */
const CANDIDATE_LIMIT = 50;

/** The OAuth callback this adapter registers with Linear. */
function redirectUri(): string {
  const base = env.BETTER_AUTH_URL ?? env.APP_URL;
  return `${base}/api/integrations/linear/callback`;
}

/** The Authorization header value for a stored token: Bearer for OAuth, raw key for a PAT. */
function authHeader(conn: DecryptedConnection): string {
  return conn.authType === "oauth" ? `Bearer ${conn.accessToken}` : conn.accessToken;
}

// The Linear GraphQL shapes we read (a subset).
type LinearViewer = { id: string; name: string };
type LinearIssue = {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  url: string;
  completedAt: string | null;
  team: { key: string; name: string } | null;
};
type LinearTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

/**
 * Run a GraphQL query with a ready-made Authorization header value. Resolves to the
 * `data` payload on success; throws a user-facing (redacted) Error otherwise — Linear
 * returns HTTP 200 with an `errors` array for auth/validation problems, so both are
 * checked. The raw provider error is never surfaced (spec: redacted in error surfaces).
 */
async function graphql<T>(
  authorization: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "BragBit",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("Linear rejected that token. Check it and try again.");
  }
  if (res.status === 429) {
    throw new Error("Linear rate limit reached. Wait a few minutes and try again.");
  }
  if (!res.ok) throw new Error(`Linear request failed (${res.status}).`);

  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error("Linear rejected that request. Reconnect the integration and try again.");
  }
  if (!json.data) throw new Error("Linear returned an empty response.");
  return json.data;
}

/** The connected account's Linear id + display name, for a token. */
async function fetchIdentity(
  authorization: string,
): Promise<{ externalAccountId: string; externalAccountLabel: string }> {
  const data = await graphql<{ viewer: LinearViewer }>(
    authorization,
    "query Me { viewer { id name } }",
    {},
  );
  return { externalAccountId: data.viewer.id, externalAccountLabel: data.viewer.name };
}

/** POST the OAuth token endpoint (code exchange or refresh) and parse the token response. */
async function postToken(body: Record<string, string>): Promise<LinearTokenResponse> {
  const res = await fetch(OAUTH_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": "BragBit",
    },
    body: new URLSearchParams(body).toString(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Linear token request failed (${res.status}).`);
  return (await res.json()) as LinearTokenResponse;
}

export const linearProvider: IntegrationProvider = {
  id: "linear",
  label: "Linear",
  supportsPat: true, // a Personal API key (the "paste a token" path)

  oauthConfigured: () => Boolean(env.LINEAR_IMPORT_CLIENT_ID && env.LINEAR_IMPORT_CLIENT_SECRET),

  authorizeUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: env.LINEAR_IMPORT_CLIENT_ID ?? "",
      redirect_uri: redirectUri(),
      scope: OAUTH_SCOPES,
      state,
    });
    return `${OAUTH_AUTHORIZE}?${params.toString()}`;
  },

  async exchangeCode(code: string): Promise<ConnectionTokens> {
    const data = await postToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      client_id: env.LINEAR_IMPORT_CLIENT_ID ?? "",
      client_secret: env.LINEAR_IMPORT_CLIENT_SECRET ?? "",
    });
    if (!data.access_token) {
      throw new Error("Linear did not return an access token — the code may have expired.");
    }
    const identity = await fetchIdentity(`Bearer ${data.access_token}`);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      accessTokenExpiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
      scopes: data.scope,
      ...identity,
    };
  },

  async validatePat(token: string): Promise<ConnectionTokens> {
    // Personal API keys authenticate with the raw key (no "Bearer" prefix) and don't expire.
    const identity = await fetchIdentity(token);
    return { accessToken: token, ...identity };
  },

  async refreshTokens(refreshToken: string): Promise<RefreshedTokens> {
    const data = await postToken({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: env.LINEAR_IMPORT_CLIENT_ID ?? "",
      client_secret: env.LINEAR_IMPORT_CLIENT_SECRET ?? "",
    });
    if (!data.access_token) {
      throw new Error(
        "Linear did not return a refreshed access token — reconnect the integration.",
      );
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token, // Linear may rotate the refresh token; keep the new one when present
      accessTokenExpiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
      scopes: data.scope,
    };
  },

  async revokeToken(token: string): Promise<void> {
    // Best-effort (the caller ignores failures): tell Linear to drop the access token.
    await fetch(OAUTH_REVOKE, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${token}`,
        "User-Agent": "BragBit",
      },
      body: new URLSearchParams({ token }).toString(),
      cache: "no-store",
    });
  },

  async fetchCandidates(conn: DecryptedConnection, since?: Date): Promise<RawCandidate[]> {
    // Completed issues assigned to the connected user. `since` (the last sync) bounds
    // re-imports; the first import (no `since`) takes the page of completed issues,
    // ordered by most-recent update to mirror the GitHub adapter's `sort:updated`.
    const filter = since
      ? { completedAt: { gte: since.toISOString() } }
      : { completedAt: { null: false } };
    const query = `query Completed($first: Int!, $filter: IssueFilter) {
      viewer {
        assignedIssues(first: $first, filter: $filter, orderBy: updatedAt) {
          nodes { id identifier title description url completedAt team { key name } }
        }
      }
    }`;

    const data = await graphql<{ viewer: { assignedIssues: { nodes: LinearIssue[] } } }>(
      authHeader(conn),
      query,
      { first: CANDIDATE_LIMIT, filter },
    );

    return data.viewer.assignedIssues.nodes.map((issue) => ({
      externalId: issue.id,
      externalUrl: issue.url,
      sourceType: "issue" as const,
      title: issue.title,
      occurredAt: issue.completedAt ? new Date(issue.completedAt) : null,
      payload: {
        identifier: issue.identifier,
        team: issue.team?.name ?? issue.team?.key ?? "",
        body: issue.description ? issue.description.slice(0, 1000) : "",
      },
    }));
  },
};

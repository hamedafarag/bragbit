import "server-only";

import { env } from "@/lib/env";

import type {
  ConnectionTokens,
  DecryptedConnection,
  IntegrationProvider,
  RawCandidate,
} from "./types";

// GitHub adapter (docs/specs/integrations.md). v1 imports the user's merged pull
// requests via the search API. The OAuth code exchange lands in slice 1c; the PAT
// path and candidate fetch are implemented here (slice 1b).

const API = "https://api.github.com";

/**
 * Requested OAuth scopes. `public_repo` is the safer default (public repos only);
 * an operator who wants private-repo PRs swaps in `repo`. `read:user` identifies
 * the connected account. Documented tradeoff in the spec.
 */
const OAUTH_SCOPES = "read:user public_repo";

/** One search page per import — bounded (the spec notes this cap; auto-import is deferred). */
const CANDIDATE_LIMIT = 50;

/** The OAuth callback this adapter registers with GitHub. */
function redirectUri(): string {
  const base = env.BETTER_AUTH_URL ?? env.APP_URL;
  return `${base}/api/integrations/github/callback`;
}

/** Authenticated GitHub REST GET. Resolves to the Response on 2xx; throws a user-facing Error otherwise. */
async function ghGet(path: string, token: string): Promise<Response> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "BragBit",
    },
    cache: "no-store",
  });
  if (res.ok) return res;
  if (res.status === 401) throw new Error("GitHub rejected that token. Check it and try again.");
  if (res.status === 403)
    throw new Error("GitHub rate limit reached. Wait a few minutes and try again.");
  throw new Error(`GitHub request failed (${res.status}).`);
}

// The GitHub fields we read (a subset of the REST shapes).
type GhUser = { id: number; login: string };
type GhSearchItem = {
  node_id: string;
  number: number;
  title: string;
  html_url: string;
  body: string | null;
  closed_at: string | null;
  repository_url: string;
  pull_request?: { merged_at: string | null };
};
type GhSearchResult = { items: GhSearchItem[] };

/** "https://api.github.com/repos/<owner>/<repo>" → "<owner>/<repo>". */
function repoFullName(repositoryUrl: string): string {
  return repositoryUrl.split("/repos/")[1] ?? "";
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

  // OAuth code exchange — slice 1c.
  exchangeCode: async (): Promise<ConnectionTokens> => {
    throw new Error("github.exchangeCode is implemented in slice 1c");
  },

  async validatePat(token: string): Promise<ConnectionTokens> {
    const res = await ghGet("/user", token);
    const user = (await res.json()) as GhUser;
    // Classic PATs report granted scopes in this header; fine-grained tokens omit it.
    const scopes = res.headers.get("x-oauth-scopes")?.trim() || undefined;
    return {
      accessToken: token,
      externalAccountId: String(user.id),
      externalAccountLabel: user.login,
      scopes,
    };
  },

  async fetchCandidates(conn: DecryptedConnection, since?: Date): Promise<RawCandidate[]> {
    const login = conn.externalAccountLabel;
    if (!login) {
      throw new Error("This GitHub connection is missing its account handle; reconnect it.");
    }

    const qualifiers = ["type:pr", `author:${login}`, "is:merged"];
    if (since) qualifiers.push(`merged:>=${since.toISOString().slice(0, 10)}`);
    const params = new URLSearchParams({
      q: qualifiers.join(" "),
      sort: "updated",
      order: "desc",
      per_page: String(CANDIDATE_LIMIT),
    });

    const res = await ghGet(`/search/issues?${params.toString()}`, conn.accessToken);
    const { items } = (await res.json()) as GhSearchResult;

    return items.map((pr) => {
      const merged = pr.pull_request?.merged_at ?? pr.closed_at;
      return {
        externalId: pr.node_id,
        externalUrl: pr.html_url,
        sourceType: "pull_request" as const,
        title: pr.title,
        occurredAt: merged ? new Date(merged) : null,
        payload: {
          number: pr.number,
          repo: repoFullName(pr.repository_url),
          body: pr.body ? pr.body.slice(0, 1000) : "",
        },
      };
    });
  },
};

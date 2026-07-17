# Spec — BragBit MCP connector (v2)

> **Status:** **implemented 2026-07-16.** Tracked from [PLAN.md §11](../../PLAN.md) and the
> [enhancement backlog](../enhancements.md).

## Implementation note (2026-07-16) — OAuth 2.1, not PATs

The MVP shipped with **OAuth 2.1** instead of the personal-access-token design sketched below. Better
Auth (already a dependency) ships an `mcp` plugin that turns BragBit into a full OAuth 2.1 / OIDC
provider, giving Claude Desktop / claude.ai a "paste the instance URL → click Authorize" connect flow
with no token to copy. What that changed versus the PAT sketch further down:

- **Auth** — the Better Auth `mcp` plugin ([src/lib/auth/index.ts](../../src/lib/auth/index.ts))
  registers `/api/auth/mcp/{authorize,token,register,get-session}` plus the `.well-known` discovery
  docs (re-exported at the origin root:
  [src/app/.well-known/](../../src/app/.well-known/)). Dynamic client registration (RFC 7591) + PKCE
  are on. Scopes: `openid profile offline_access brags:write documents:read`
  ([src/lib/mcp/scopes.ts](../../src/lib/mcp/scopes.ts)).
- **Tables** — three OIDC tables (`oauth_application`, `oauth_access_token`, `oauth_consent`) in
  [src/lib/db/schema/oauth.ts](../../src/lib/db/schema/oauth.ts) (migration `0008`), _not_ a `tokens`
  table.
- **Transport** — the MCP endpoint at [src/app/api/mcp/route.ts](../../src/app/api/mcp/route.ts) uses
  Vercel's `mcp-handler` (wraps the official SDK), stateless (no Redis). `withMcpAuth` validates the
  Bearer access token via `auth.api.getMcpSession` and hands the tools the user id.
- **Consent + login** — an OAuth consent screen at [/oauth/consent](../../src/app/oauth/consent/) and
  a sign-in round-trip that resumes the authorize flow.
- **Settings** — instead of "generate/revoke a token", Settings → **Connected apps** lists authorized
  clients with a **Revoke** ([src/features/oauth-clients/](../../src/features/oauth-clients/)).
- **Tenant scoping** — the tools resolve the workspace through the DAL per call (list = across the
  user's memberships; add = derived from the target document), never trusting the token, so isolation
  is identical to the UI. A token is _not_ pre-bound to one workspace (the PAT sketch's model).

The original PAT design is kept below as the historical proposal.

## Goal

Let a developer record a brag **without leaving their AI assistant**. The user is working in Claude
Desktop (or any [MCP](https://modelcontextprotocol.io) client), realizes they just did something
brag-worthy, says _"log this as a brag,"_ and it's captured in their BragBit instance — with the AI
applying the formula (_what you did + why it mattered + the measurable result_) as it writes.

This is the AI-native member of the §11 "capture from where you work" family (alongside the CLI and
Slack bridge), and the highest-leverage one for a developer audience.

## Why it fits

- **On-thesis** — the product's core battle is capture friction; this removes a context switch at
  the exact moment a win happens.
- **AI-free product, AI-capable capture** — the enhancement happens in the user's _own_ AI client,
  so BragBit ships no AI keys or infra (honoring the "fully useful with zero AI" non-goal). It may
  reduce or remove the need for the in-app BYO-key AI item in §11.
- **Reuses the DAL** — writes go through the existing feature modules, inheriting workspace +
  ownership scoping unchanged.

## User story

1. In **Settings → Access tokens**, the user creates a **personal access token** scoped to
   `write:brags` (+ optionally `read:documents`).
2. They add their instance to Claude Desktop as a connector: the instance URL + the token.
3. In any conversation: _"Brag: shipped the realtime crew heatmap, cut crew-location time 22 → 5 min."_
4. Claude calls `bragbit_add_brag`; the win lands in their chosen document; Claude confirms with a
   link.

## Scope (MVP)

A **remote MCP server mounted in the app** (no separate process), authenticated by a PAT. Keep the
toolset tiny — capture-first:

| Tool                     | Purpose                                  | Inputs                                                                                            |
| ------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `bragbit_add_brag`       | Record a win                             | `title` (required); optional `impact`, `category`, `documentId`, `date`, `links[]`, `description` |
| `bragbit_list_documents` | Let the AI pick / confirm the target doc | —                                                                                                 |

Deferred (opt-in, post-MVP): `bragbit_search_brags` — recall past wins (e.g. to draft a self-review).
This is **read access to career data**, so it is explicitly opt-in and separately scoped.

## Architecture

- **Transport** — a Next.js route handler at `/api/mcp` implementing the MCP **Streamable HTTP**
  transport. It ships with BragBit, so a self-host needs no extra service (true to "one
  `docker compose up`").
- **Auth** — `Authorization: Bearer <PAT>`. The token resolves to a `{ userId, workspaceId, scopes }`
  context; every tool call runs through the **same DAL** as the UI (an explicit-scope guard, like the
  export queries already use), so tenant isolation is unchanged.
- **Tools → feature modules** — `bragbit_add_brag` → `features/brag` create; `bragbit_list_documents`
  → `features/document` list. No new business logic; a thin adapter over what exists.

## Dependencies (the foundation — all PLAN §11)

1. **Personal access tokens** — a `tokens` table (hashed token, `user_id`, `workspace_id`, scopes,
   created / last-used / expires, revoked); a generate + revoke UI in Settings (token shown once,
   stored argon2-hashed like share passwords); and a `requireToken` DAL guard — the non-session
   sibling of `requireWorkspace`, returning explicit scope.
2. A small **authorized surface** the tools call (or the MCP handler invokes the feature modules
   directly with the token's scope).

The MCP connector is the headline use of that foundation; the CLI and Slack bridge reuse it.

## Security & privacy

- Tokens are **scoped** (`write:brags` by default; any `read:*` is opt-in) and **revocable**, shown
  once on creation, stored hashed.
- A read/search tool surfaces past wins into an AI client → **opt-in only**, never in the default
  scope.
- All writes are workspace + user scoped through the DAL; a token can never cross tenants.
- Rate-limit the endpoint (reuse `lib/rate-limit`).

## Out of scope (v2 MVP)

- The OAuth connector flow (a PAT is simpler for self-host; OAuth is a later UX nicety).
- Editing / deleting brags via MCP (capture-first; manage in the app).
- Bulk import / git-history extraction — that's the companion CLI (§11).

## Open questions

- **PAT vs. OAuth** for the Claude Desktop connector UX — PAT for the MVP; revisit OAuth via Better
  Auth.
- Whether to expose `read` / `search` at all in v2, given the privacy surface.
- Multi-workspace: a token is scoped to one workspace; a user in several creates one token each
  (fine for the MVP).

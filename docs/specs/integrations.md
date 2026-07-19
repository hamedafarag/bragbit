# Spec — BragBit source integrations (GitHub / Linear / Jira import)

> **Status:** **GitHub + Linear implemented** — GitHub v1 (2026-07-17, slices 1a–1e) and Linear
> (2026-07-19, slices 2a–2e) on `feat/source-integrations`: token/OAuth connect, manual import,
> dedup, review queue, approve/dismiss/disconnect, plus OAuth token **refresh** (Linear) and a
> per-member import **rate-limit**. Tracked from [PLAN.md §11](../../PLAN.md) —
> _"GitHub/Jira/Linear OAuth import (approve-each-entry UX, source deep links)"_ — and the
> [enhancement backlog](../enhancements.md). Jira and weekly auto-import remain deferred (see
> [Deferred](#deferred-post-v1)).

## Goal

Let a developer turn the work they've **already shipped** into brags without retyping it. They connect
GitHub (their own account), press **Import now**, and their merged pull requests appear as a **review
queue** of candidate brags — each pre-filled with the _"what"_ (title, date, a deep link back to the
PR). The user approves, edits, or dismisses each one; approving creates a real brag through the normal
data layer, and they add the _"why it mattered + result"_ the formula asks for.

This is the "capture from where you work" family member for **retroactive** capture — the complement
to the [MCP connector](mcp-connector.md) (in-the-moment capture) and the reminder emails (prompted
capture).

## Why it fits

- **On-thesis** — the product's core battle is capture friction. A year of merged PRs is the richest
  unclaimed source of "what did you do this year?"; importing them removes the retype tax.
- **Approve-each-entry, never silent** — imports land in a review queue, so the timeline never fills
  with low-signal noise. The human still authors intent; the import just kills the blank page.
- **Reuses the DAL** — approving a candidate calls the existing `features/brag` create path, inheriting
  workspace + ownership scoping unchanged. Source deep links reuse the existing `bragLink` table, so
  the `brag` schema is untouched.
- **Off by default, free for everyone** — a provider only appears when the operator configures it (or,
  for GitHub, when a user pastes a token). No AI, no paid tier, no BragBit-hosted middleman touching
  tokens. Honors the "fully useful with zero integrations" non-goal ([PLAN §9](../../PLAN.md)).

## User story

**Org member (`private-org`).** The company's operator has set `GITHUB_IMPORT_CLIENT_ID/SECRET` once.
Priya opens **Settings → Integrations**, clicks **Connect with GitHub**, authorizes, and presses
**Import now**. Her 18 merged PRs from this cycle appear as candidates. She approves 11 into her review
document (each carrying a link back to the PR), edits two to add impact, and dismisses the rest. Her
admin never sees any of it.

**Solo self-hoster (`private-solo`).** John's instance has no OAuth app configured. He pastes a
read-only fine-grained GitHub PAT, presses **Import now**, and gets the same review queue — zero
operator setup.

## Tenancy & configuration (the load-bearing section)

"Configure for the organization" splits into two layers that BragBit's tenancy model keeps separate.

### 1. Enabling — instance / operator level (env)

The **OAuth app** is instance-level, set by the operator, exactly like the existing social-login
providers ([`configuredOAuthProviders()`](../../src/lib/oauth.ts),
[`lib/auth/index.ts`](../../src/lib/auth/index.ts)):

- In `private-org`, the instance **is** one organization and the operator **is** the company, so env
  config _is_ org config. One GitHub OAuth App → `GITHUB_IMPORT_CLIENT_ID` / `GITHUB_IMPORT_CLIENT_SECRET`
  → the **Connect** button lights up for every member.
- A provider card renders only when its creds are present. Zero config → the section is empty and the
  app is unaffected.
- **PAT paste needs no env**, so a bare instance still supports import for the user who brings a token.

Keep `GITHUB_IMPORT_*` **separate** from the social-login `GITHUB_CLIENT_*` app: different scopes
(login needs `read:user` with `disableSignUp`; import needs PR/repo read), least privilege. (An
operator _may_ reuse one app; separate is recommended.)

### 2. Using — per member, per workspace (the connection)

Each member connects **their own** provider account and imports **their own** work into **their own**
documents. The connection is scoped `(userId, workspaceId, provider)`:

- Never visible to admins — consistent with _"admins manage workspaces, never members' content"_
  ([PLAN §9](../../PLAN.md)).
- Cascade-purges with the membership on [export-then-delete](../../src/features/workspace/offboard.ts).
- Workspace-scoped so a user who belongs to both a personal and an org workspace connects per
  workspace and imports into the right documents. In v1 self-host a user is in exactly one workspace,
  so there is zero re-auth friction; the scoping only "costs" anything in the multi-membership hosted
  future, where the isolation is exactly what you want.

### 3. No shared org account

There is deliberately **no** "org connects one GitHub org and imports everyone's PRs" mode. A brag is
personal evidence; you import _your_ PRs into _your_ document. The org enables the capability; each
person brings their own account. This is a non-goal, not a missing feature.

### The invariant

> **The OAuth _app_ is instance-level (env); the _account / site_ is chosen per user at connect time.**

Jira's `cloudId`, a GitHub `login`, a Linear workspace — all resolved per connection and stored in
`integration_connection.config`, never in env. This one rule makes the model work identically for all
three providers and for both self-host and hosted.

### Hosted extension (deferred, additive)

On a shared multi-tenant instance the operator ≠ the org admin, so a future slice adds a
**per-workspace admin UI** (in the existing `src/app/(app)/admin` area) where an org
admin pastes their own app creds — stored encrypted in a `workspace_integration_config` row — plus an
org-wide enable/disable toggle per provider. The connection tables don't change; only a config-source
lookup ("env → workspace override") is added. Same "workspace-scoped from day one so hosted stays
additive" philosophy as the rest of the schema ([PLAN §3](../../PLAN.md)).

## Scope

**GitHub + Linear. Manual `Import now`. Connect via OAuth _or_ a pasted token.** No cron, no
auto-import toggle, no Jira yet.

| Capability      | Shipped                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Providers       | GitHub, Linear                                                                                                                        |
| Sources pulled  | GitHub merged PRs (`type:pr author:@me is:merged`); Linear completed issues (`viewer.assignedIssues`, `completedAt`)                  |
| Connect methods | Per provider: an **OAuth App** (operator-configured) **and** a pasted read-only **token** — GitHub PAT / Linear API key (zero-config) |
| Trigger         | Manual **Import now** button (per connection), rate-limited per member                                                                |
| Review          | Per-candidate **Approve / Edit-then-approve / Dismiss**; dedup across re-imports                                                      |
| On approve      | `features/brag` create + a `bragLink` deep link back to the source                                                                    |
| Token refresh   | GitHub OAuth tokens don't expire; **Linear** OAuth tokens (~24h) are auto-refreshed before each import                                |
| Auto-import     | ❌ deferred (mockup's weekly toggle omitted)                                                                                          |
| Commits         | ❌ deferred ("significant commits" is a noisy heuristic; merged PRs only)                                                             |

## Data model

Two new tables. The `brag` table is **not** modified; source links reuse `bragLink`.

```
integration_connection    id, userId FK, workspaceId FK, provider,          -- provider: 'github' (v1)
                           authType,                                          -- 'oauth' | 'pat'
                           externalAccountId, externalAccountLabel,           -- e.g. GitHub numeric id + login
                           accessToken(enc), refreshToken(enc)?,              -- AES-256-GCM at rest
                           accessTokenExpiresAt?, scopes, config(json)?,      -- config: provider extras (cloudId, …)
                           lastSyncedAt?, createdAt, updatedAt
                           UNIQUE (userId, workspaceId, provider)
                           -- autoImport column is added later with the cron slice, not in v1.

import_candidate           id, connectionId FK, userId, workspaceId, provider,
                           externalId, externalUrl, sourceType,               -- sourceType: 'pull_request' (v1)
                           title, suggestedCategory, occurredAt, payload(json),
                           status,                                            -- 'pending' | 'approved' | 'dismissed'
                           bragId FK? (onDelete set null),                    -- set on approve
                           createdAt, updatedAt
                           UNIQUE (userId, provider, externalId)              -- ← dedup crux
```

- **`import_candidate` unique key** makes re-import idempotent: a PR already seen — whether the user
  approved _or_ dismissed it — is skipped, so a future weekly cron needs no rework. Deleting the
  approved brag nulls `bragId` but leaves `status = approved`, so it is not re-suggested.
- **Token encryption** — a new reversible helper (AES-256-GCM), key from `INTEGRATIONS_TOKEN_KEY` or
  HKDF-derived from `BETTER_AUTH_SECRET`. (Distinct from share passwords, which are one-way argon2.)
  These tokens carry PR/repo read scope, so they live in their own table encrypted, not in Better
  Auth's plaintext `account`.

## Architecture

One-way import direction unchanged: `app/` → `features/integrations` → `lib/auth/guards` (DAL) →
`lib/db`.

- **Provider adapter interface** (`features/integrations/providers/<provider>.ts`), one registry
  drives the UI (only `isConfigured()` providers render):

  ```ts
  type IntegrationProvider = {
    id: "github"; // v1
    label: string;
    isConfigured(): boolean; // OAuth env creds present (PAT path is always available)
    authorizeUrl(state: string): string;
    exchangeCode(code: string): Promise<ConnectionTokens>;
    validatePat(token: string): Promise<ConnectionIdentity>; // GitHub PAT path
    fetchCandidates(conn: Connection, since?: Date): Promise<RawCandidate[]>;
  };
  ```

- **OAuth routes** — `GET /api/integrations/[provider]/authorize` (session-guarded; signed `state`
  carrying `userId` + `workspaceId` + a CSRF nonce; PKCE) → provider consent →
  `GET /api/integrations/[provider]/callback` (validate `state`, exchange code, fetch identity, upsert
  the encrypted connection, redirect to Settings → Integrations). GitHub OAuth Apps issue
  non-expiring tokens, so v1 needs no refresh plumbing.

- **PAT path** — a server action: validate the pasted token via `GET /user`, store it encrypted with
  `authType = 'pat'`. No callback, no refresh.

- **Import** — `Import now` (server action) → `fetchCandidates` → upsert into `import_candidate`
  (skip existing `externalId`) → the review queue renders pending rows.

- **Approve** — a server action maps the candidate → `BragInput` and calls the existing
  `features/brag` create through the workspace guard, then inserts a `bragLink` (url = `externalUrl`,
  label = e.g. `"GitHub PR #123"`) and marks the candidate `approved` with `bragId`. Tenant isolation
  is identical to the [MCP service](../../src/features/mcp/service.ts).

- **Target document** — the active workspace's most-recently-updated document (mirrors the MCP
  connector's `mostRecentDocument`), overridable by the user in the review UI.

_(Implementation note: per [AGENTS.md](../../AGENTS.md), verify Route Handler + Server Action APIs
against `node_modules/next/dist/docs/` before coding — this is Next 16.2, not stock.)_

## GitHub → brag mapping

| GitHub (merged PR)                 | Brag field                                                         |
| ---------------------------------- | ------------------------------------------------------------------ |
| PR title                           | `title`                                                            |
| `merged_at`                        | `date`                                                             |
| —                                  | `category` = `shipped-work` (suggested; user can change)           |
| `html_url`                         | a `bragLink` (`"PR #<n> in <owner>/<repo>"`)                       |
| PR body (truncated, markdown kept) | `descriptionMd`                                                    |
| —                                  | `impactMd` left blank — the user adds _"why it mattered + result"_ |

Fetch: `GET /search/issues?q=type:pr+author:@me+is:merged` with a `since` bound; `externalId` = the PR
node id. Scope: `public_repo` (safer default) or `repo` (includes private) — documented tradeoff.

## Linear → brag mapping

| Linear (completed issue)  | Brag field                                                          |
| ------------------------- | ------------------------------------------------------------------- |
| issue `title`             | `title`                                                             |
| `completedAt`             | `date`                                                              |
| —                         | `category` = `shipped-work` (suggested; user can change)            |
| `url`                     | a `bragLink` (`"<identifier>"` + team, e.g. `"ENG-42 in Platform"`) |
| `description` (truncated) | `descriptionMd`                                                     |
| —                         | `impactMd` left blank — the user adds _"why it mattered + result"_  |

Fetch: a GraphQL `viewer { assignedIssues(filter: { completedAt: … }, orderBy: updatedAt) }` query
against `https://api.linear.app/graphql`, bounded by the last sync (`completedAt.gte`); `externalId` =
the issue node id, `sourceType` = `issue`. The **auth header differs by connect path** — OAuth is
`Bearer <token>`, a Personal API key is the raw key (no prefix). OAuth access tokens expire (~24h) and
are refreshed (via the stored refresh token) before the fetch; a Personal API key never expires.

## Security & privacy

- **Tokens encrypted at rest** (AES-256-GCM); never logged; redacted in any error surface.
- **Least privilege** — GitHub `public_repo` default, `repo` opt-in; document what each grants.
- **CSRF/PKCE** on the OAuth round-trip; validate `state`; reject callbacks with a mismatched nonce.
- **Disconnect** deletes the connection, best-effort revokes the provider token, and clears that
  connection's pending candidates.
- **Tenant isolation** — connections and candidates scoped by `userId` + `workspaceId`; approval runs
  through the workspace guard. A connection can never reach another user's or tenant's data — same
  guarantee the [MCP service](../../src/features/mcp/service.ts) documents.
- **Abuse bound** — cap candidates fetched per `Import now`; rate-limit the import action
  ([`lib/rate-limit`](../../src/lib/rate-limit.ts)).

## Slice checklist (v1)

- [x] **1a** — schema (`integration_connection`, `import_candidate`) + migration; token-crypto helper;
      `features/integrations` skeleton + provider registry; env vars in
      [`env.ts`](../../src/lib/env.ts) + [`.env.example`](../../.env.example)
- [x] **1b** — GitHub **PAT path**: `validatePat` + `fetchCandidates` (merged PRs) → `Import now` →
      dedup → review-queue reads → approve (reuses `createBrag` + source `bragLink`) / dismiss /
      disconnect. Server vertical + integration tests (real Postgres); the browser UI is **1d**.
- [x] **1c** — GitHub **OAuth path**: `authorize` + `callback` route handlers (CSRF state cookie,
      `exchangeCode`, shared encrypted `upsertConnection`) + the "Connect with GitHub" button and a
      status flash. Route + adapter unit-tested; authorize/flash verified in-browser. _(The full
      round-trip against real GitHub needs an operator-registered OAuth app — covered by unit tests.)_
- [x] **1d** — **Settings → Integrations** section + review-queue UI: provider cards (connect via
      PAT / import / disconnect) + candidate list (approve / dismiss, choose target document).
      Verified in-browser + jsdom render tests. _Inline edit-then-approve deferred (the
      `approveCandidate` action already accepts `edits`; only the edit form is missing)._
- [x] **1e** — tests (adapter mapping, dedup, DAL scoping, disconnect — landed with 1b/1c) + docs:
      operator guide [`docs/self-hosting/integrations.md`](../self-hosting/integrations.md), env
      reference, a [user-guide](../user-guide.md#importing-from-github) section, CHANGELOG + README.

## Slice checklist (Linear)

- [x] **2a** — vocabulary + wiring: `provider: 'linear'` + `sourceType: 'issue'` in the zod enums (no
      migration — the columns are free-form text); `LINEAR_IMPORT_CLIENT_ID/SECRET` env; the
      `providers/linear.ts` adapter + registry entry; `authType` projected onto `DecryptedConnection`;
      `refreshTokens?` / `revokeToken?` added to the adapter contract; the `linkLabel` branch + payload
      widening in `mapping.ts`.
- [x] **2b** — Linear **API-key path**: `validatePat` (raw-header `viewer` identity) + `fetchCandidates`
      (GraphQL completed issues → candidates). `Import now` → dedup → review queue → approve, reusing the
      existing action layer unchanged. Adapter unit tests + mapping/registry tests.
- [x] **2c** — Linear **OAuth path** + refresh: the OAuth routes genericized to `[provider]` (per-provider
      CSRF cookie + status strings; GitHub unchanged); `exchangeCode` (stores refresh + expiry);
      `refreshTokens` + `refreshConnectionToken` (persist the rotated token) + refresh-before-import in
      `importNow`; best-effort `revokeToken` on disconnect; a per-member import **rate-limit**. Route +
      adapter tests (incl. DB-gated refresh/revoke).
- [x] **2d** — UI: the Linear provider card (icon, token help, provider-specific copy — "completed
      issues", "Linear API key") + flash messages; the settings page and review queue render it with no
      changes (both are provider-generic). jsdom render test.
- [x] **2e** — docs: this spec, the operator guide, a
      [user-guide](../user-guide.md#importing-from-linear) section, `.env.example`, CHANGELOG, README,
      PLAN §11.

## Deferred (post-v1)

- **Weekly auto-import** — in-process `node-cron` + an external-cron fallback route mirroring
  [`/api/cron/reminders`](../../src/app/api/cron/reminders/route.ts) (same `CRON_SECRET`), plus the
  `autoImport` column and the mockup's toggle. Fetches into the **review queue** — never auto-publishes.
  The `import_candidate` unique key already makes it idempotent.
- **Jira** — Atlassian 3LO (`read:jira-work`); resolved issues; `cloudId` + site picker at connect
  time into `config`.
- **GitHub commits** — a "significant commit" heuristic (deferred as noisy).
- **Hosted per-workspace config** — the admin-UI credential override + org-wide enable/disable (see
  [Tenancy §hosted extension](#hosted-extension-deferred-additive)).
- **Auto-approve** — an optional power-user setting to skip review for high-confidence sources.

## Open questions

- **GitHub OAuth App vs GitHub App** — v1 uses an OAuth App (non-expiring token, simplest). A GitHub
  App gives finer per-repo scoping + expiring tokens but adds refresh plumbing; revisit if operators
  ask for repo-level restriction.
- **`INTEGRATIONS_TOKEN_KEY` vs HKDF from `BETTER_AUTH_SECRET`** — a dedicated key allows rotating
  integration tokens independently of the auth secret; deriving avoids a new required env. Leaning
  derive-with-optional-override.
- **Default category** — always `shipped-work`, or map by PR labels? v1: always `shipped-work`,
  user-editable.

# Source integrations (GitHub & Linear)

Let each member import the work they've already shipped — **GitHub merged pull requests** and
**Linear completed issues** — as brags they review before anything is logged. Imports never publish
automatically: they land in a per-member review queue in **Settings → Integrations**, where each item
is approved into a document (the member adds the "why it mattered") or dismissed. See the
[spec](../specs/integrations.md) for the design.

Integrations are **off until you enable them**, and private career data stays private — a member
connects **their own** account and imports into **their own** documents; admins never see it.

## How members connect

Two paths per provider. Pick either or offer both:

- **Paste a token — no operator setup.** The member creates a read-only token at the provider — a
  GitHub [fine-grained PAT](https://github.com/settings/personal-access-tokens) (Pull requests:
  Read-only), or a Linear [Personal API key](https://linear.app/settings/account/security) (Read
  access, optionally limited to specific teams) — and pastes it in Settings → Integrations. Works on
  any instance out of the box — nothing to configure.
- **Connect (OAuth) — one click.** Available once you register that provider's OAuth app and set its
  env below. The member clicks **Connect with GitHub** / **Connect with Linear** and authorizes; no
  token to copy or store.

## Registering the GitHub OAuth app (optional)

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App** (on a user or org account).
2. Set the **Authorization callback URL** to `{APP_URL}/api/integrations/github/callback`
   (e.g. `https://bragbit.example.com/api/integrations/github/callback`).
3. Generate a client secret, then set in your environment:

   ```bash
   GITHUB_IMPORT_CLIENT_ID=...
   GITHUB_IMPORT_CLIENT_SECRET=...
   ```

The **Connect with GitHub** button appears for everyone on the instance once both are set. Keep this
**separate** from the `GITHUB_CLIENT_*` sign-in app ([OAuth](../configuration.md)) — different
scopes, least privilege.

## Registering the Linear OAuth app (optional)

1. Linear → **Settings → API → OAuth applications → Create new**.
2. Set the **Callback URL** to `{APP_URL}/api/integrations/linear/callback`
   (e.g. `https://bragbit.example.com/api/integrations/linear/callback`).
3. Copy the client ID and secret, then set in your environment:

   ```bash
   LINEAR_IMPORT_CLIENT_ID=...
   LINEAR_IMPORT_CLIENT_SECRET=...
   ```

The **Connect with Linear** button appears for everyone once both are set; the flow requests only the
read-only `read` scope. Unlike GitHub, Linear's OAuth access tokens **expire (~24h)** — BragBit stores
the refresh token and **refreshes automatically** before each import, so members stay connected. On
**Disconnect**, the token is best-effort revoked at Linear.

## Scopes & private repositories

For **GitHub**, the OAuth flow requests `read:user public_repo`, so it imports PRs from **public**
repositories. To import PRs from **private** repositories, a member uses the **token** path with a
fine-grained token granted read access to those repos — the token's own permissions decide what's
visible, so nothing broader than they choose is ever requested.

For **Linear**, the OAuth flow requests only `read`. A member who prefers a token creates a read-only
Personal API key (optionally scoped to specific teams); the key's own permissions decide what's
visible, so nothing broader than they choose is imported.

## Token encryption

Stored provider tokens are encrypted at rest (AES-256-GCM). The key derives from
`INTEGRATIONS_TOKEN_KEY` when set, otherwise from `BETTER_AUTH_SECRET`. Set a dedicated value
(`openssl rand -base64 32`) to rotate integration tokens independently of the auth secret; changing
it invalidates existing connections, so members simply reconnect.

## What gets imported

- **Merged pull requests** the connected user authored (GitHub) → candidate brags carrying the title,
  the merge date, and a link back to the PR. The member approves each (choosing the target document)
  or dismisses it.
- **Completed issues** assigned to the connected user (Linear) → candidate brags carrying the title,
  the completion date, and a link back to the issue (e.g. `ENG-42`).
- Re-running **Import now** is **deduped** on the source id, so already-seen items — approved or
  dismissed — never reappear. Import is manual today (and rate-limited per member); scheduled weekly
  import is planned.

See the [user guide](../user-guide.md#importing-from-github) for the member-facing walkthrough.

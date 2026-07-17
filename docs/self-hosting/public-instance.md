# Hosting BragBit publicly (hosted mode)

A **hosted** instance is a shared, multi-tenant BragBit that anyone can sign up to — open
registration with required email verification, each signup landing in its own personal workspace, and
any user free to create organizations and invite a team. It adds an instance **superadmin** console
and **abuse controls** (disposable-email blocking, per-workspace storage quotas, shared
rate-limiting) that the single-tenant private modes don't need.

This guide builds on the deployment mechanics in the [Docker Compose](docker-compose.md) and
[Dokploy](dokploy.md) guides — deploy the stack exactly as described there, then apply the hosted
settings below. For the conceptual model, see [Instance modes](../instance-modes.md); for every variable
and its default, [Configuration](../configuration.md).

> **Public means public.** Open signup, real user data, and inbound mail raise the stakes: use a
> domain with TLS, a reputable SMTP relay, and off-host backups ([Backup, restore &
> upgrades](backup-and-upgrades.md)) before you announce it.

## 1. Switch the instance to hosted mode

Set `INSTANCE_MODE=hosted` (alongside the usual `APP_URL`, `BETTER_AUTH_SECRET`, `POSTGRES_PASSWORD`,
and the `SMTP_*` block — see the [Dokploy guide](dokploy.md#3-set-environment-variables)).

Unlike the private modes, hosted has **no `/setup` wizard** — there's no single owner to provision.
The first visitor uses the public `/sign-up` page like everyone else; email verification is required,
so SMTP must work before you open the doors. Each new account (email/password, OAuth, or an accepted
invitation) is automatically given its own personal workspace.

## 2. Appoint instance superadmins

`SUPERADMIN_EMAILS` is a comma/space-separated allowlist of email addresses that may reach the
**`/super`** instance-admin console. It grants nothing on its own — the person still signs up
normally; once their verified account's email matches the allowlist, `/super` becomes available to
them. To everyone else the route returns 404 (it doesn't advertise its existence).

```bash
SUPERADMIN_EMAILS="you@example.com, ops@example.com"
```

Change the allowlist and redeploy to add or remove superadmins; it's read at request time, so no data
migration is involved.

## 3. Tune the abuse controls

All hosted-only, and on by default — adjust to taste ([Configuration →
Hosted-mode abuse controls](../configuration.md#hosted-mode-abuse-controls)):

- **`WORKSPACE_QUOTA_MB`** (default `2048`) — the per-workspace storage quota applied to attachment
  uploads; an upload that would exceed it is refused. The `/super` console can override the quota for
  an individual workspace (a generous limit for a trusted org, a tighter one for a suspicious
  signup); the override wins over this default.
- **`BLOCK_DISPOSABLE_EMAIL`** (default `true`) — rejects signups from known throwaway-email domains
  at registration, cutting the cheapest source of disposable accounts.
- **`MAX_UPLOAD_MB`** (default `25`) — the per-attachment size cap, independent of mode but worth
  lowering on a public instance.

**Signup rate-limiting** is automatic: sign-in/sign-up are limited per client IP. In hosted mode the
limiter state lives in Postgres, so it holds across every app container (see scaling, below). For the
limit to count the _real_ client and not your proxy, make sure the app sees the client IP — it reads
`X-Forwarded-For` by default; set `TRUSTED_PROXY_IP_HEADER` if your proxy uses another header (e.g.
`cf-connecting-ip`). Only trust that header behind a proxy that sets it.

## 4. Operate it from `/super`

Signed in as a superadmin, `/super` lists every workspace and account with:

- **member counts, storage quota, and suspension state** per workspace, and the signup feed;
- a **suspend** toggle for an abusive workspace or account — a suspended workspace (or account) is
  frozen out of the app (its members bounce to `/suspended`) without deleting anything;
- a per-workspace **quota override** input.

The console shows operational metadata only — **never** members' documents or brag content. That
boundary is deliberate and enforced at the query layer.

## 5. Scaling and branding notes

- **Multiple app containers.** Because the rate-limiter (and Better Auth's limiter) share state
  through Postgres in hosted mode, you can run more than one app replica behind a load balancer and
  the limits still hold. Postgres remains the single stateful service to size and back up.
- **Per-workspace branding.** Each workspace self-brands (name, accent, logo) — an organization's
  share pages and in-app theme use its own brand, while a personal workspace and all pre-sign-in
  pages use the BragBit default. There's nothing to configure; the schema is workspace-scoped from
  day one.

## See also

- [Instance modes](../instance-modes.md) — `hosted` versus the private modes.
- [Configuration](../configuration.md) — the full variable reference.
- [Admin guide](../admin-guide.md) — owner/admin tools inside a workspace (branding, members,
  invitations), which apply to any organization on the instance.
- [Backup, restore & upgrades](backup-and-upgrades.md) — protecting a live instance.

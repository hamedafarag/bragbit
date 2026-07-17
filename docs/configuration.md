# Configuration

Every BragBit setting is an environment variable, validated at boot by
[`src/lib/env.ts`](../src/lib/env.ts) — a misconfigured instance fails fast with a clear error. The
annotated template is [`.env.example`](../.env.example); copy it to `.env` and fill it in.

Under Docker Compose the database connection and the local-storage path are wired to the bundled
services for you (see [Self-hosting](self-hosting/)), so you only set the instance shape, `APP_URL`,
the auth secret, and SMTP.

## Instance shape

| Variable        | Default        | Notes                                                                                                                   |
| --------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `INSTANCE_MODE` | `private-solo` | `private-org` \| `private-solo` \| `hosted` — picks the deployment shape. See [Instance modes](instance-modes.md).      |
| `SETUP_TOKEN`   | _(unset)_      | Optional secret gating the first-run `/setup` wizard (private modes). Set it if the URL is reachable before you finish. |

## Core

| Variable       | Default                 | Notes                                                                                                                                                                                                                                                                               |
| -------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`     | `development`           | Set to `production` for a real deployment (the Docker image sets this for you).                                                                                                                                                                                                     |
| `APP_URL`      | `http://localhost:3000` | The instance's public origin — baked into emails, share links, and auth callbacks. Set it to your real URL; use `https` in production — Better Auth derives the session-cookie `Secure` flag from the scheme, so an `http` value behind a TLS proxy ships cookies without `Secure`. |
| `DATABASE_URL` | _(required)_            | PostgreSQL connection string. Compose sets this to the bundled `postgres` service.                                                                                                                                                                                                  |

## Auth (Better Auth)

| Variable                  | Default             | Notes                                                                                                                                                             |
| ------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`      | _(required)_        | Session-signing secret, **minimum 32 characters** (the app refuses to boot otherwise). Generate with `openssl rand -base64 32`; rotating it invalidates sessions. |
| `BETTER_AUTH_URL`         | `APP_URL`           | Override only if auth runs on a different origin than `APP_URL`.                                                                                                  |
| `TRUSTED_PROXY_IP_HEADER` | _(x-forwarded-for)_ | Header carrying the real client IP for per-IP rate-limiting. Set only for a proxy that uses a non-standard header (e.g. `cf-connecting-ip`).                      |

Auth endpoints are rate-limited in production (3 requests/10s on sign-in and sign-up, 3/60s on
password reset and verification email). Better Auth reads the client IP from `X-Forwarded-For` by
default, so per-client limiting works behind the reference reverse proxy; set
`TRUSTED_PROXY_IP_HEADER` if your proxy uses a different header (e.g. `cf-connecting-ip`). Only trust
that header when a proxy sets it — a directly-exposed app could let a client spoof it. On a `hosted`
instance the limiter state is shared across app instances via Postgres (ENH-SEC-02), so limits hold
even with more than one container running; the private single-container modes use an in-process limiter.

## Email (SMTP)

Email is required — verification, invitations, password reset, and weekly reminders all send mail.
In local dev, point these at the dev stack's Mailpit.

| Variable                      | Default                            | Notes                                  |
| ----------------------------- | ---------------------------------- | -------------------------------------- |
| `SMTP_HOST`                   | _(unset)_                          | SMTP relay host.                       |
| `SMTP_PORT`                   | `587`                              | `465` with implicit TLS.               |
| `SMTP_SECURE`                 | `false`                            | `true` for implicit TLS (port 465).    |
| `SMTP_USER` / `SMTP_PASSWORD` | _(unset)_                          | Credentials, if your relay needs them. |
| `SMTP_FROM`                   | `BragBit <no-reply@bragbit.local>` | The From address on all mail.          |

## Storage

| Variable                                    | Default           | Notes                                                |
| ------------------------------------------- | ----------------- | ---------------------------------------------------- |
| `STORAGE_DRIVER`                            | `local`           | `local` (disk) or `s3` (any S3-compatible endpoint). |
| `STORAGE_DIR`                               | `./.data/uploads` | Local-disk root. Compose mounts a named volume here. |
| `S3_ENDPOINT`                               | _(unset)_         | e.g. an AWS S3, Cloudflare R2, or MinIO endpoint.    |
| `S3_REGION`                                 | _(unset)_         |                                                      |
| `S3_BUCKET`                                 | _(unset)_         |                                                      |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | _(unset)_         | S3 credentials.                                      |
| `S3_FORCE_PATH_STYLE`                       | `true`            | Required for MinIO; set `false` for AWS S3.          |

Attachments are never publicly addressable — they stream through an authorizing route. Only
workspace logos and avatars are public.

## OAuth (optional)

Set both halves of a provider to enable its sign-in button. Register the callback URL
`{APP_URL}/api/auth/callback/{github|google}` with the provider. In the private modes OAuth only
signs in an already-provisioned, email-verified account — it never creates one (preserving
invitation-only).

| Variable                                    | Notes                |
| ------------------------------------------- | -------------------- |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth app.    |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth client. |

## Uploads

| Variable        | Default | Notes                                                                               |
| --------------- | ------- | ----------------------------------------------------------------------------------- |
| `MAX_UPLOAD_MB` | `25`    | Per-attachment size cap. Avatars (5 MB) and workspace logos (2 MB) have fixed caps. |

## Hosted-mode abuse controls

Relevant only when `INSTANCE_MODE=hosted` (ships in v1.1).

| Variable                 | Default | Notes                                                                                                 |
| ------------------------ | ------- | ----------------------------------------------------------------------------------------------------- |
| `BLOCK_DISPOSABLE_EMAIL` | `true`  | Block known disposable-email domains at sign-up.                                                      |
| `WORKSPACE_QUOTA_MB`     | `2048`  | Per-workspace storage quota (default; the `/super` console can override it per workspace).            |
| `SUPERADMIN_EMAILS`      | —       | Comma/space-separated allowlist of emails granted the `/super` instance-admin console (empty = none). |

## Reminders

The standalone (Docker) server schedules weekly reminders itself, in-process — no external cron
needed.

| Variable      | Default   | Notes                                                                                                                          |
| ------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `CRON_SECRET` | _(unset)_ | Serverless hosts only: guards `POST /api/cron/reminders` so an external scheduler can trigger a send. Use a long random value. |

## Timing & limits

Optional knobs; the defaults match the shipped behaviour. Lower them to exercise the time-bound
flows without waiting (e.g. a short `INVITATION_TTL_DAYS` to test invite expiry, or
`RATE_LIMIT_ENABLED=true` to hit the brute-force limiter in dev).

| Variable                 | Default                 | Notes                                                                                                         |
| ------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `INVITATION_TTL_DAYS`    | `7`                     | Lifetime of a workspace invite link.                                                                          |
| `AUTH_TOKEN_TTL_MINUTES` | `60`                    | Lifetime of email-verification and password-reset links.                                                      |
| `REMINDER_HOUR`          | `9`                     | Local hour (0–23) the weekly reminder fires on the chosen day.                                                |
| `REMINDER_DEDUP_HOURS`   | `20`                    | Window that suppresses a duplicate reminder send.                                                             |
| `RATE_LIMIT_ENABLED`     | _(on in prod, off dev)_ | Brute-force limiter on the auth endpoints. Unset follows `NODE_ENV`; `true`/`false` forces it on either side. |

## Docker Compose knobs

Read by [`docker-compose.yml`](../docker-compose.yml) itself (not the app):

| Variable            | Default   | Notes                                                         |
| ------------------- | --------- | ------------------------------------------------------------- |
| `POSTGRES_PASSWORD` | `bragbit` | Password for the bundled Postgres + the wired `DATABASE_URL`. |
| `APP_PORT`          | `3000`    | Host port mapped to the app container.                        |

See also [Instance modes](instance-modes.md) and [Self-hosting](self-hosting/).

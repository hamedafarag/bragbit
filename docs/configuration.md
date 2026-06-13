# Configuration

Every BragBit setting is an environment variable, validated at boot by `src/lib/env.ts`.
The canonical list with defaults lives in [`.env.example`](../.env.example).

> **Status:** all current variables are grouped below; the polished per-variable
> reference (defaults, examples, validation notes) is finalized in Phase 9.

## Variable groups

- **Instance shape** — `INSTANCE_MODE`, `SETUP_TOKEN`
- **Core** — `APP_URL`, `DATABASE_URL`
- **Auth** — `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- **Email (SMTP)** — `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- **Storage** — `STORAGE_DRIVER` (`local` is implemented; `s3` lands in Phase 4), `STORAGE_DIR`
  (the local volume), `S3_*`
- **OAuth (optional)** — `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID` /
  `GOOGLE_CLIENT_SECRET`. Set both halves to enable a provider's button. Callback URL to register
  with the provider: `{APP_URL}/api/auth/callback/{github|google}`. In the private modes OAuth
  only signs in already-provisioned accounts (it links to an existing email-verified account and
  never creates a new one).
- **Uploads** — `MAX_UPLOAD_MB` (attachments; avatars are capped at 5 MB and workspace logos at
  2 MB, independent of this)
- **Hosted abuse controls** — `BLOCK_DISPOSABLE_EMAIL`, `WORKSPACE_QUOTA_MB`
- **Reminders** — `CRON_SECRET`

See also [Instance modes](instance-modes.md).

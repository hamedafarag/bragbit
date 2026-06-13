# Configuration

Every BragBit setting is an environment variable, validated at boot by `src/lib/env.ts`.
The canonical list with defaults lives in [`.env.example`](../.env.example).

> **Status:** stub — expanded as features land (full reference by Phase 9).

## Variable groups

- **Instance shape** — `INSTANCE_MODE`, `SETUP_TOKEN`
- **Core** — `APP_URL`, `DATABASE_URL`
- **Auth** — `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- **Email (SMTP)** — `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- **Storage** — `STORAGE_DRIVER`, `STORAGE_DIR`, `S3_*`
- **OAuth (optional)** — `GITHUB_*`, `GOOGLE_*`
- **Uploads** — `MAX_UPLOAD_MB`
- **Hosted abuse controls** — `BLOCK_DISPOSABLE_EMAIL`, `WORKSPACE_QUOTA_MB`
- **Reminders** — `CRON_SECRET`

See also [Instance modes](instance-modes.md).

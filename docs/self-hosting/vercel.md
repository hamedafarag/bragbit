# Self-hosting on Vercel + managed Postgres

BragBit can run on [Vercel](https://vercel.com) with a managed Postgres such as
[Neon](https://neon.tech). This is a serverless deployment, which trades the one-command Compose
stack for three things you have to arrange yourself: **object storage**, **migrations**, and the
**reminder cron**. If you can run a container, the [Docker Compose](docker-compose.md) path is
simpler.

## 1. Database

Create a Postgres database (Neon, Supabase, RDS, …) and copy its connection string into
`DATABASE_URL`. Serverless functions open many short-lived connections, so use the provider's
**pooled** connection string if it offers one.

## 2. Storage must be S3

Serverless has no persistent local disk, so the `local` storage driver won't work. Set
`STORAGE_DRIVER=s3` and the `S3_*` block to an S3-compatible bucket (AWS S3, Cloudflare R2). See the
storage section of [Configuration](../configuration.md).

## 3. Project & environment variables

Import the repository into Vercel and set the environment variables in the project settings —
`INSTANCE_MODE`, `APP_URL` (your Vercel domain), `BETTER_AUTH_SECRET`, `DATABASE_URL`, the `S3_*`
block, the `SMTP_*` block, and `CRON_SECRET` (below). The `output: 'standalone'` option in
`next.config.ts` is harmless here — Vercel uses its own build pipeline.

## 4. Run migrations

The Docker entrypoint that auto-migrates doesn't exist on Vercel, so run migrations yourself against
the production database:

```bash
DATABASE_URL='...your production url...' pnpm db:migrate
```

Run this once before the first deploy, and again after any upgrade that adds a migration. (You can
also wire it into a CI step that runs before promoting a deploy.)

## 5. Weekly reminders via Vercel Cron

The in-process scheduler only runs in the long-lived standalone server, not on serverless. Instead,
set `CRON_SECRET` and let [Vercel Cron](https://vercel.com/docs/cron-jobs) call the secured endpoint.
Add a `vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/reminders", "schedule": "0 * * * *" }]
}
```

Vercel sends the cron request with an `Authorization: Bearer <CRON_SECRET>` header, which the route
verifies. An hourly tick is enough — a user is due only in the single local hour their reminder
fires.

## 6. Deploy

Deploy the project and open your Vercel domain — on first run (private modes) you'll land on the
`/setup` wizard. Make sure `APP_URL` matches the domain so emails and share links resolve correctly.

# Self-hosting with Dokploy (reference deployment)

[Dokploy](https://dokploy.com) is an open-source, self-hostable deployment platform. It runs your
Docker Compose stack on your own VPS and handles domains and automatic TLS (via Traefik), which makes
it BragBit's reference target — you get the one-command Compose stack plus a managed HTTPS front door,
without renting a PaaS.

This guide assumes you've read the [Docker Compose guide](docker-compose.md); Dokploy deploys that
same `docker-compose.yml`.

## 1. Provision a host and install Dokploy

Start with a small VPS (2 GB RAM is plenty) running a recent Linux with Docker. Install Dokploy
following its [installation docs](https://docs.dokploy.com) — a single command brings up the Dokploy
UI on the server. Open it and create your admin account.

## 2. Create a Compose application

In Dokploy, create a **Project**, then add a **Compose** service inside it:

- Point it at your BragBit repository (Git provider or URL) on the branch you want to deploy.
- Set the compose file path to `docker-compose.yml`.

Dokploy will build the image (the multi-stage `Dockerfile`) and run the stack.

## 3. Set environment variables

In the service's **Environment** settings, add the same variables you'd put in `.env`:

- `INSTANCE_MODE` — `private-org` or `private-solo`.
- `APP_URL` — `https://your-domain` (the domain you'll attach below).
- `BETTER_AUTH_SECRET` — `openssl rand -base64 32`.
- `POSTGRES_PASSWORD` — a strong password.
- The `SMTP_*` block — your transactional-email relay.

`DATABASE_URL` and `STORAGE_DIR` are wired by Compose, so you don't set them. See
[Configuration](../configuration.md) for the full list (storage, OAuth, reminders).

## 4. Attach a domain

Add a **Domain** to the `app` service pointing at container port `3000`, set the host to your
domain, and enable HTTPS — Dokploy provisions a Let's Encrypt certificate automatically. Point your
domain's DNS at the server first. Make sure `APP_URL` matches this domain exactly.

## 5. Deploy

Trigger a deploy. On start, the container runs the database migrations automatically and then boots
the server; the in-process weekly-reminder scheduler runs inside it, so no external cron is needed.
Visit your domain — on first run you'll land on the `/setup` wizard.

## Updating

Push to the deployed branch (or click **Redeploy**). Dokploy rebuilds and restarts the stack;
migrations run again on start (a no-op when there's nothing new). Back up first — see
[Backup, restore & upgrades](backup-and-upgrades.md). Your data persists in the stack's named volumes
across redeploys.

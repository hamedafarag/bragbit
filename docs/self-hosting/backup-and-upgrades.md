# Backup, restore & upgrades

BragBit's state is two things: the **Postgres database** (accounts, workspaces, documents, brags) and
the **uploaded files** (attachments, avatars, logos). Back up both.

## Backing up the database

With the Docker Compose stack, dump Postgres with `pg_dump`:

```bash
docker compose exec -T postgres pg_dump -U bragbit bragbit > bragbit-$(date +%F).sql
```

Keep these dumps off-box (object storage, another host). For a managed Postgres (Neon, RDS), use the
provider's automated backups / point-in-time restore instead.

## Backing up the files

- **Local storage (default):** the files live in the `bragbit_uploads` Docker volume. Archive it:

  ```bash
  docker run --rm -v bragbit_bragbit_uploads:/data -v "$PWD":/backup alpine \
    tar czf /backup/bragbit-uploads-$(date +%F).tgz -C /data .
  ```

  (The volume is prefixed with the Compose project name — confirm the exact name with
  `docker volume ls`.)

- **S3 storage:** your bucket is the source of truth; rely on the provider's versioning / backups.

## Restoring

Restore the database into a running, empty Postgres:

```bash
docker compose exec -T postgres psql -U bragbit -d bragbit < bragbit-2026-06-15.sql
```

Restore files by extracting the archive back into the `bragbit_uploads` volume (or your S3 bucket).
Restore the database and files from the **same** point in time so attachment rows and stored objects
match.

## Upgrading

Migrations run automatically on container start, so upgrading is pull-and-restart:

```bash
# 1. Back up first (above).
# 2. Get the new version.
git pull                      # or pull a new image tag
# 3. Rebuild and restart — migrations apply on boot.
docker compose up -d --build
```

Watch the logs to confirm a clean start:

```bash
docker compose logs -f app
```

You'll see the migrate step (`[migrate] database is up to date`) before the server starts.

### Notes

- **Migrations are forward-only.** There's no automated down-migration; to roll back a bad upgrade,
  restore the pre-upgrade database backup. This is why step 1 matters.
- **Read the changelog** before upgrading — [`CHANGELOG.md`](../../CHANGELOG.md) calls out anything
  that needs attention.
- **Pin a version** in production (a tag or commit) rather than tracking a moving branch, so upgrades
  are deliberate.

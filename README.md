# BragBit

> **Your promotion evidence, on your own Postgres.**

BragBit is an open-source (AGPL-3.0), self-hostable, white-label **brag-document tracker** for developers. Log your wins all year (a "brag" takes under 30 seconds), organize them into documents (one per review cycle), see them as a month-grouped timeline, and share a read-only link with your manager before review time.

<!-- badges: CI · license · release — added with the CI pipeline -->

> ⚠️ **Status:** pre-release, under active development — not yet ready for production self-hosting. Tracking toward `v0.1.0`; see [PLAN.md](PLAN.md).

## Why

Career evidence — promotion cases, praise, salary arguments — is sensitive. BragBit runs on infrastructure you trust: no entry caps, no vendor that might fold, Markdown export so you can always leave.

## Deployment modes

| Mode           | Who runs it                    | Accounts                        | Ships |
| -------------- | ------------------------------ | ------------------------------- | ----- |
| `private-org`  | a company self-hosting         | setup wizard + invitations      | v1    |
| `private-solo` | a freelancer self-hosting      | setup wizard                    | v1    |
| `hosted`       | a shared multi-tenant instance | open signup + user-created orgs | v1.1  |

## Highlights

- Sub-30-second capture; month-grouped timeline; tags, filtering & full-text search
- Multiple documents per user, each with its own revocable (optionally password-protected) share link
- Per-brag privacy; attachments of any type; Markdown / PDF / JSON export
- Per-workspace white-labeling (name, logo, accent); weekly email reminders
- Self-host with one `docker compose up` (Postgres-backed)

## Quick start

> Full self-hosting guides live in [`docs/self-hosting/`](docs/self-hosting/) (Dokploy reference + Docker Compose + Vercel/Neon) and come together through Phase 9.

Local development:

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

## Tech

Next.js 16 (App Router) · TypeScript · PostgreSQL · Drizzle ORM · Better Auth · Tailwind v4 + shadcn/ui · Zod. The architecture and the data-access security model are in [`docs/architecture.md`](docs/architecture.md).

## Documentation

- [Configuration](docs/configuration.md) — every environment variable
- [Instance modes](docs/instance-modes.md) — `private-org` vs `private-solo` vs `hosted`
- [Admin guide](docs/admin-guide.md) · [User guide](docs/user-guide.md)
- [Self-hosting](docs/self-hosting/)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). This project follows [Conventional Commits](https://www.conventionalcommits.org/) and [Keep a Changelog](https://keepachangelog.com/). By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[AGPL-3.0](LICENSE) — network copyleft keeps hosted forks open-source.

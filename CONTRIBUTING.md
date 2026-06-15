# Contributing to BragBit

Thanks for your interest! BragBit is AGPL-3.0 and welcomes issues and pull requests.

## Local development

Requirements: **Node 20+**, **pnpm 10+** (via Corepack), and a local **Docker** daemon for the dev
stack.

```bash
pnpm install
cp .env.example .env
pnpm dev:up          # Postgres + Mailpit + MinIO (docker-compose.dev.yml)
pnpm db:migrate      # apply migrations
pnpm seed:demo       # optional — a sample workspace + a populated "2026" document
pnpm dev             # Next.js dev server on http://localhost:3000
```

`pnpm dev:up` starts the local services from `docker-compose.dev.yml`: Postgres, Mailpit (its web UI
is on `:8025` — dev mail lands there, not a real inbox), and MinIO for S3-compatible storage. Stop
them with `pnpm dev:down`.

### Scripts

| Command           | Purpose                                 |
| ----------------- | --------------------------------------- |
| `pnpm dev`        | Run the app in development              |
| `pnpm build`      | Production build                        |
| `pnpm lint`       | ESLint                                  |
| `pnpm typecheck`  | TypeScript                              |
| `pnpm test`       | Unit tests (Vitest)                     |
| `pnpm db:migrate` | Apply database migrations (drizzle-kit) |
| `pnpm seed:demo`  | Seed a demo workspace + document        |

Also available: `pnpm test:e2e` (Playwright), `pnpm lint:md`, `pnpm format`, `pnpm size`, and
`pnpm dev:up` / `pnpm dev:down` for the Docker stack.

For manual / QA verification, the [manual test plan](docs/testing.md) is a step-by-step catalogue of
test cases across Phases 1–9 (organized by feature, with priorities and a per-mode smoke test).

## Branch & PR workflow

1. Branch off `main` (`feat/…`, `fix/…`, `docs/…`).
2. Keep PRs focused and fill in the PR template checklist.
3. Update `CHANGELOG.md` under `[Unreleased]` and any relevant `/docs` for user-facing changes.
4. Make sure lint, typecheck, and tests pass.

## Conventional Commits

Commit messages — and squash-merge PR titles — follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(brag): add quick-add keyboard shortcut
fix(share): 404 revoked share tokens
docs(self-hosting): document WORKSPACE_QUOTA_MB
chore(deps): bump drizzle-orm
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`.
This is enforced by `commitlint` + a git hook (added in the tooling step).

## Code of Conduct

By participating you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

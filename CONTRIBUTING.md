# Contributing to BragBit

Thanks for your interest! BragBit is AGPL-3.0 and welcomes issues and pull requests.

## Local development

Requirements: **Node 20+**, **pnpm 9+**, and a local **Docker** daemon for the dev stack.

```bash
pnpm install
pnpm dev          # Next.js dev server on http://localhost:3000
```

The local dev stack (Postgres + MinIO + Mailpit via `docker-compose.dev.yml`) lands in the
data-layer step; until then the UI runs against the design baseline.

### Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Run the app in development |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |

(Typecheck plus unit (Vitest) and e2e (Playwright) scripts arrive with the CI setup.)

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

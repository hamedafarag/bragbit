# Changelog

All notable changes to BragBit are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). BragBit stays
on `0.x` until the deployment modes and core stabilize.

## [Unreleased]

### Added

- Initial project scaffold: Next.js 16 (App Router, TypeScript), Tailwind v4, ESLint.
- "Engineering logbook" design system — paper palette, Fraunces + IBM Plex typography, the
  8 category colors, and a per-workspace accent CSS variable (see `design-mockup.html`).
- shadcn/ui set up and reconciled with the logbook palette (brand accent = the runtime
  `--primary` variable); primitives: Button, Input, Label, Textarea, Card, Badge, Dialog.
- Repository foundation: AGPL-3.0 license, contribution & security docs, `/docs` skeleton,
  `.env.example`, and the `INSTANCE_MODE` config module (`src/lib/env.ts`, `src/lib/instance.ts`).
- Data layer: Drizzle ORM + postgres.js client (`src/lib/db`), drizzle-kit config and schema
  conventions, plus a local dev stack (`docker-compose.dev.yml` — Postgres + MinIO + Mailpit).

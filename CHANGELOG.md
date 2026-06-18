# Changelog

All notable changes to BragBit are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). BragBit stays
on `0.x` until the deployment modes and core stabilize.

## [Unreleased]

### Changed

- The root path `/` is now a thin mode- and session-aware redirect (to `/setup`, `/dashboard`, or
  `/sign-in`) instead of a placeholder timeline — the leftover Phase-0 demo content is gone.

## [0.1.0] - 2026-06-15

The first release: a self-hostable, white-label brag-document tracker for the two private
(self-host) deployment modes. The hosted multi-tenant mode is the v1.1 fast-follow.

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
- Email infrastructure: Nodemailer SMTP transport (`src/lib/email`) + a workspace-brandable
  React Email base layout and first template (`src/emails`), with a typed `sendEmail()` helper.
- CI (GitHub Actions): typecheck, lint, Prettier check, markdownlint, unit (Vitest) and e2e
  (Playwright) tests, production build, Lighthouse CI, a bundle-size budget, and a link check.
- Auth & workspaces: Better Auth (email+password with required verification, organization
  plugin) with the core auth + organization/member/invitation Drizzle schema and first
  migration, plus the DAL guards (`requireSession` / `requireWorkspace` / `requireRole`).
- First-run setup wizard (`/setup`, private modes): creates the owner + first workspace and
  signs them in; `sonner` toasts and the shared form↔action Zod validation pattern.
- Auth UI: sign-in, forgot-password, password-reset, and email-verification pages (a gated
  `(auth)` route group on the typed Better Auth client).
- Organization invitations: a branded 7-day single-use invite email + the accept flow
  (`/accept-invitation/[id]`) — a new invitee registers bound to the invited email and joins
  the workspace as a member.
- Active-workspace resolution on sign-in: a Better Auth session hook pins the caller's
  workspace as the active organization, so `requireWorkspace()` works after a plain
  email+password sign-in (not only after setup / invite acceptance).
- Storage adapter with a `LocalDiskStorage` driver (path-traversal-guarded `put/get/delete/stream`,
  workspace-prefixed keys); `S3Storage` is selected by `STORAGE_DRIVER` but lands in Phase 4.
- Profile (`/profile`): display name, role title, team, bio, and avatar upload — saved to a new
  `profiles` table; the display name mirrors to the account name. Avatars stream through an
  authorizing `/api/files/[…]` route (members only), never a public URL.
- Account settings (`/settings`): change email (verified accounts confirm from their current
  inbox before it applies), change password (signs out other sessions), and delete account
  (cascades the user's data and drops a sole-member personal workspace and its avatar).
- The authenticated `(app)` shell: a workspace-branded header with profile/settings nav and
  sign-out, wrapping the new profile and settings pages.
- Optional GitHub/Google sign-in, enabled per provider via env. The sign-in page shows a
  provider button only when configured; account linking lets a verified user attach an
  identity. In the private modes OAuth only signs in existing accounts (it never creates one,
  preserving invitation-only).
- Phase 1 documentation: the user guide (signing in, OAuth, verification, password reset,
  profile & account), the admin guide (roles + the invitation model), and the architecture
  guide's authentication/tenancy + DAL sections.
- Workspace administration (`/admin`, owner/admin only): set the workspace name, accent color
  (validated hex with a live preview), and logo. The accent and logo are applied to the app
  chrome and the sign-in page; logos upload through a role-gated route and are served publicly
  (avatars remain session-gated).
- Members management for organizations (`/admin/members`): list members with role, join date,
  and last activity; invite one or more people with a role; resend or revoke pending invitations;
  change a member's role; remove a member; and transfer ownership (owner only, atomic). Owner
  protection is enforced throughout, and personal workspaces have no member surface.
- Branded email templates: invitations carry the inviting organization's brand, and the
  transactional emails (verification, password reset, email-change confirmation) carry the
  instance brand.
- The brag-domain schema (`documents`, `brags`, `brag_links`, `tags`, `brag_tags`, all
  workspace-scoped) in one migration — documents are scoped per workspace and per user, brags
  hang off a document, and tags are unique per user per workspace.
- Documents (`/dashboard`): the authenticated home lists your documents (review periods like
  “2026” or “H1 2026”). Create and edit in a dialog (title required; optional subtitle, period,
  and Markdown goals), archive (reversible, in a restorable “Archived” view), and delete
  (cascading the document's brags). Documents are private per user and guarded through the DAL on
  every read and write; sign-in, setup, and invitation acceptance now land on the dashboard.
- S3-compatible storage: an `S3Storage` driver (MinIO/R2/S3, path-style by default) selected by
  `STORAGE_DRIVER=s3`, alongside the local-disk default. The storage interface gained `stat()` and
  inclusive byte-range streaming for ranged downloads. Added the `attachments` table (file metadata
  and storage key); the adapter is covered by a MinIO integration test in CI.
- Attachments on brags: upload files (images, PDFs, office docs — multi-file, capped by
  `MAX_UPLOAD_MB`) on an existing brag from the editor; they show as paperclip chips on the card and
  a managed list (thumbnail/icon, size, delete) in the editor. Files stream through the authorizing
  file route — owner-only, with the stored MIME type and `Range`/206 support — and are never
  publicly addressable.
- Document timeline: a document's brags render as a month-grouped timeline — sticky month headers
  with per-month counts, a vertical spine, and a status-only node on each entry (solid = shipped,
  hollow = in-progress) — replacing the flat list. Category colors, the "In progress" pill, the
  private card treatment, and link/attachment chips sit along the spine.
- Tags on brags: add tags while editing (type to add, with autocomplete from your existing tags) —
  scoped per user per workspace and reused across brags (no duplicates), rendered as monochrome
  `#name` chips on the timeline card.
- Full-text search: a generated `search` tsvector on brags (weighted title/impact/description) with
  a GIN index powers global search across your documents in the workspace. A header search box opens
  `/search` — ranked results grouped by document, each deep-linking straight to the brag.
- Timeline filters: filter a document's timeline by category, tag, or date range from a filter bar
  (URL-driven, so a filtered view is shareable); quiet months between entries are marked so your
  logging cadence stays visible.
- Brag detail view: click a brag's title for a focused read view — full rendered Markdown, impact,
  links, collaborators, tags, and attachments with inline image previews and file sizes (the
  timeline keeps compact chips).
- Polish: per-route loading skeletons (dashboard, document, search), an app error boundary with
  retry, and an in-chrome "not found" page; a responsive pass so the header, timeline, and filters
  work cleanly on mobile with no horizontal overflow.
- Per-brag visibility: mark a brag “Private” in the editor — it's shown to you with a dashed
  “Private” card treatment and will be hidden from shared views and exports. (The `share_links`
  schema for revocable share links also landed, ahead of the sharing UI.)
- Share links (owner side): a “Share” dialog on the document page creates a secret read-only
  link (a 24-byte base64url token — the only credential), with copy-to-clipboard, rotate
  (revoke the old token and mint a fresh one), and stop-sharing. One active link per document;
  the dialog shows when it was last opened. The public view at `/share/[token]` lands next.
- Public share page (`/share/[token]`): a read-only, login-free view of a document — workspace
  branded (logo, name, accent), a month-grouped timeline of only the **shared** brags (private
  ones are filtered out at the query layer, so they never appear in a share or its attachments),
  with links and attachments. Attachments stream through the file route via the share token
  (no session). The page is `noindex`, carries a “Powered by BragBit” footer, and records when
  it was last opened (shown to the owner); an unknown or revoked token shows a friendly 404.
- Optional share passwords: an owner can set, change, or remove a password on a share link
  (argon2-hashed, never stored in clear). A protected link shows an unlock gate — a no-JS form —
  and reveals nothing about the document until the correct password is entered; success sets an
  httpOnly per-share cookie that's invalidated automatically if the password changes. Unlock
  attempts are rate-limited per share, and password-gated attachments require the unlock too.
- Markdown export: an “Export” dialog on the document page downloads a document as a clean,
  portable Markdown file — metadata and goals, then wins grouped by month with links, an
  attachment manifest, collaborators, and tags. Private brags are excluded by default, with an
  opt-in to include them in your own copy.
- Print / PDF export: a print-optimized, workspace-branded view of a document (logo header, clean
  typography, each month on its own page) reachable from the Export dialog — “Print / Save as PDF”
  uses your browser's print-to-PDF, so no extra services are required. Honors the same
  include-private choice, marking private wins so they aren't shared unawares.
- Data export (JSON): a “Download JSON” in Settings exports your entire dataset — every document
  (archived included) and every brag (private included), with links, attachment metadata, and
  tags — in one portable, versioned JSON file. Your career data is always yours to take.
- Weekly reminder emails (opt-in): choose a day and time zone in Settings to get a workspace-branded
  “What did you ship this week?” nudge with a one-tap link to log a win. Sent on your chosen day in
  your own time zone (deduplicated so you never get two), with one-click unsubscribe in every email.
  The standalone server schedules delivery itself (an in-process hourly job); a secured cron endpoint
  (`POST /api/cron/reminders`, guarded by `CRON_SECRET`) is available for serverless hosts.
- Production Docker stack: a multi-stage `Dockerfile` (Next.js standalone output, a slim non-root
  runner) and a `docker-compose.yml` that brings up the app + Postgres in one `docker compose up`.
  Pending database migrations are applied automatically on container start, and S3-compatible storage
  is available behind a `--profile minio`. The `.env.example` is finalized for both the local-dev and
  Docker paths (Compose auto-wires the database connection and the storage volume), and the pnpm
  version is pinned via `packageManager`.
- Demo seed (`pnpm seed:demo`): one command populates a fresh database with a sample personal
  workspace, a ready-to-use owner account (`demo@bragbit.local`), and a "2026" document with a
  handful of varied brags — shipped and in-progress, shared and private, a recognition quote, links,
  and tags — so you can sign in and explore a populated timeline immediately. Idempotent and
  independent of the app (raw SQL + Better Auth's password hasher).
- Documentation: finalized the self-hosting guides (Docker Compose, the Dokploy reference, and a
  Vercel/Neon variant), the full environment-variable reference, the instance-modes explainer, and
  backup/restore & upgrade notes; refreshed the admin and user guides to match the shipped product;
  and polished the README (quick starts, highlights, demo credentials) and the contributor guide.

### Security

- A document can have at most one active share link, now enforced by a database constraint (a
  partial unique index), so a create/create race can't produce two; rotating a link still works.
- Added a database-backed security test suite for sharing — revoked and unknown tokens resolve to
  nothing, private brags never appear in a share's payload or attachments, and the password gate
  (lock, unlock, rate limit) behaves — run in CI against Postgres.
- Security headers on every response (`next.config.ts`): `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy`
  that drops unused device APIs, HSTS, and a conservative `Content-Security-Policy`
  (`base-uri`/`frame-ancestors`/`object-src`) — closing off clickjacking, MIME-sniffing, and
  share-token Referer leakage app-wide.
- Rate limiting on the auth and invitation surfaces: Better Auth's limiter is explicitly enabled in
  production (strict built-in rules — 3 requests/10s on sign-in/sign-up, 3/60s on password-reset and
  verification email), and the invitation-accept entry point adds an in-house per-invite limit
  (reusing the share-unlock limiter).
- Dependency audit: the `pnpm audit` advisories are all build/dev tooling absent from the production
  standalone image; `postcss` and `js-yaml` are pinned to patched versions via pnpm overrides.
- Brags — log wins inside a document, on its own page (`/documents/[id]`). A sub-30-second
  quick-add (a title is all you need; press <kbd>N</kbd> to focus it from anywhere) plus a full
  editor with date, category (the 8-color taxonomy), status, impact, collaborators, attribution,
  multiple labeled links, and Markdown description/impact with a Write/Preview toggle. Markdown
  renders safely (react-markdown — no raw HTML, dangerous URLs stripped) server-side in the cards
  and is lazy-loaded for the editor preview; links render as external-link chips that open in a new
  tab. Each document page lists its brags newest-first with the goals rendered and a back-fill
  onboarding empty state; brags are owned through their parent document and guarded on every read
  and write.

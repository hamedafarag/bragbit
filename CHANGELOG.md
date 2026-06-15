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
- Brags — log wins inside a document, on its own page (`/documents/[id]`). A sub-30-second
  quick-add (a title is all you need; press <kbd>N</kbd> to focus it from anywhere) plus a full
  editor with date, category (the 8-color taxonomy), status, impact, collaborators, attribution,
  multiple labeled links, and Markdown description/impact with a Write/Preview toggle. Markdown
  renders safely (react-markdown — no raw HTML, dangerous URLs stripped) server-side in the cards
  and is lazy-loaded for the editor preview; links render as external-link chips that open in a new
  tab. Each document page lists its brags newest-first with the goals rendered and a back-fill
  onboarding empty state; brags are owned through their parent document and guarded on every read
  and write.

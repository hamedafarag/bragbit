# BragBit — Build Plan

> **BragBit** — an open-source (AGPL-3.0), self-hostable, white-label brag-document tracker for developers.
> Next.js + Postgres. *"Your promotion evidence, on your own Postgres."*

Plan created: 2026-06-13 · Research basis: deep dive into [bragbook.io](https://bragbook.io), [what-is-a-brag-document](https://bragbook.io/what-is-a-brag-document), [Julia Evans' brag document essay](https://jvns.ca/blog/brag-documents/), GitHub OSS landscape, and HN community discussions.

---

## 1. Vision

John is a software engineer. Every promotion cycle his manager asks "what did you do this year?" — and John can't remember. BragBit is where John logs his wins all year (a "brag" takes under 30 seconds to add), organized into documents (one per year or review cycle), rendered as a timeline, and shareable with his manager as a read-only link before the review.

**Who it serves.** Two shapes of the same need:
- **Organizations** — a company self-hosts a white-labeled instance for its developers (their name, logo, colors), invitation-only, so the instance belongs to the org's people.
- **Individuals / freelancers** — a solo developer who isn't part of any org. They can either self-host a personal instance, or sign up on a shared hosted instance (e.g. the one we run on our VPS).

**Positioning.** Career evidence — promotion cases, praise, salary arguments — is sensitive data. BragBit is open source, runs on infrastructure you trust, has no entry caps, no vendor that might fold, and Markdown export so users can always leave.

## 2. Research summary (June 2026)

What the deep dive found, and how it shapes this plan:

- **bragbook.io ("BragBook")** is a live, closed-source, solo-founder SaaS (Supabase + Vercel) targeting engineers/PMs/designers. One rolling timeline per user, tags + "collections", **one all-or-nothing public profile link**, image-only uploads, free tier hard-capped at 25 entries, $8.99/mo Premium. Its moats are AI (note "Enhance" + "Career Composer" for self-reviews/resume bullets) and read-only OAuth imports (GitHub/Jira/Linear/Asana).
- **The OSS niche is empty.** The only comparable (edspencer/bragdoc-ai, ~25 stars) is immature and AI-dependent; everything else is sub-50-star CLIs. The real competitor is a Google Doc/Notion template — and **capture friction is the universal failure mode**.
- **Table stakes** (per the genre's own doctrine): sub-30-second capture, timeline view, tags + search/filter, weekly reminders, Markdown/PDF export, read-only sharing.
- **BragBit's differentiators** (gaps the incumbent structurally can't serve):
  1. Open-source, self-hosted, white-label, no entry caps.
  2. **Multiple documents per user with per-document share links** — BragBook's own guides recommend "share selectively with your manager before a review," which its single public profile can't do.
  3. **Multiple file attachments of any type** (screenshots, PDFs, praise emails) — BragBook only does images, yet its own template says "screenshot feedback before it disappears."
  4. Per-brag privacy in a shared doc, Markdown-native, and serving **both org teams and unaffiliated freelancers from one codebase**.
- **The entry formula the whole genre teaches:** *What you did + Why it mattered + The measurable result* ("Redesigned checkout flow, reducing cart abandonment from 40% to 28%"). Bake it into the schema (dedicated impact field) and the form placeholders.
- **Stay a personal IC tool.** No manager dashboards, review workflows, or performance analytics — that's Lattice/Workleap territory. The workspace/org layer is about identity, branding, and membership; each member's brag data stays private to them (shared only via links they create).

## 3. Tenancy model (the load-bearing decision)

A single concept absorbs every scenario: a **workspace** is the tenant boundary, and a **freelancer is just a personal workspace — a workspace of one.** Everything beneath the workspace (documents, brags, timeline, sharing) is identical regardless of mode.

- **Workspace types:** `organization` (many members, branded, invitation-only, has admins) and `personal` (exactly one member = owner; org/member/invite chrome hidden).
- **`INSTANCE_MODE`** (env, set at deploy) picks the deployment shape:
  | Mode | Who runs it | Accounts come from | Workspaces | Ships |
  |---|---|---|---|---|
  | `private-org` | a company self-hosting | setup wizard + invitations | exactly one organization | **v1** |
  | `private-solo` | a freelancer self-hosting | setup wizard | exactly one personal | **v1** |
  | `hosted` | us, on our VPS | open signup (email-verified) + user-created orgs | many (personal + orgs) | **v1.1** |
- **Branding is per-workspace** (org name/logo/accent). Personal workspaces use the instance default. In the `private-org`/`private-solo` modes there is exactly one workspace, so its branding reads as instance-wide — single-org white-label is just the one-workspace special case of the general model.
- **Build order:** v1 delivers the two private (self-host) modes; `hosted` multi-tenant is a **v1.1 fast-follow**. The schema is workspace-scoped from day one so hosted is purely additive (open-signup route, user-created orgs, superadmin, quotas) — never a rewrite.

## 4. Locked decisions

| Decision | Choice |
|---|---|
| License | **AGPL-3.0** (prevents closed-source hosted forks) |
| Framework | Next.js (App Router, Server Components, Server Actions), TypeScript |
| Database | PostgreSQL |
| ORM | **Drizzle ORM** + drizzle-kit migrations |
| Auth | **Better Auth** (+ organization plugin); email+password; **required email verification**; optional GitHub/Google OAuth via env |
| Tenancy | **Workspace = tenant** (`personal` \| `organization`); `INSTANCE_MODE` = `private-org` \| `private-solo` \| `hosted` |
| Membership | Organizations: **invitation-only**. Personal: solo. Hosted instance: **open signup (email-verified) + any user can create orgs** |
| Roles | Per workspace: **Owner + Admin + Member** (owner transferable, not removable by admins). Hosted adds an **instance superadmin** for abuse/quota ops |
| Member removal | **Export-then-delete** — removed member receives a portable export, then their data is purged from the workspace |
| Branding | **Per-workspace** name + logo + accent color on login/app/share/emails; small "Powered by BragBit" stays on share pages |
| File storage | **Storage adapter**: local disk default (Docker volume), S3-compatible (MinIO/R2/S3) via env; keys prefixed per workspace |
| Deployment | **Docker Compose first** — reference target is **Dokploy on a private VPS**; Vercel-compatible secondary |
| Sharing | Revocable secret link + optional password protection + per-brag visibility (no expiry in v1) |
| Timeline | Reverse-chronological, **grouped by month** |
| V1 scope extras | Markdown descriptions, tags & filtering, Markdown/PDF export, weekly email reminders |
| UI | Tailwind CSS + shadcn/ui + **lucide-react** icons (accent color themable via CSS variables); design language = "engineering logbook" (see `design-mockup.html`) |
| Validation | Zod (shared schemas between forms and server actions) |

### Design system (reconciled with `design-mockup.html`, 2026-06-13)

- **Light-only for v1.** The warm-paper "logbook" palette ships light-only; a deliberately-designed dark variant (ink-on-dark, not a mechanical invert) is a post-v1 enhancement. (The Phase 0 "dark mode" item is removed.)
- **8 category colors** for `globals.css`: shipped `#5c8a58`, technical `#4f6d9e`, collaboration `#8b5e83`, recognition `#b08a2e`, glue `#927e63`, leadership `#9a5b3b`, skills-learning `#3f8a82`, other `#6f6757`.
- **Monochrome tags.** Faint `#text`, no per-tag color (calmer on a dense timeline); `tags.color` dropped from the v1 schema.
- **Timeline node encodes status only:** solid accent center = shipped, hollow (paper) center = in-progress; `in_progress` brags also carry an "In progress" pill on the card. (An earlier two-axis node that also put visibility on the ring was dropped — rendered at 8px, a dashed *accent* ring is invisible against the solid accent fill, so shipped·shared and shipped·private collided, and that's the common case since `status` defaults to the solid node.)
- **Private is a card treatment, never the node:** dashed card border + faint diagonal hatch + a "Private — hidden from shared views" badge carry visibility; the spine node stays status-only.
- **8 category colors verified** as dots + badges. Category color always appears paired with a text label (the spine node uses the accent, not the category color), and the colors vary in lightness, so the muted warm cluster (recognition/glue/leadership/other) reads fine; leadership stays clear of the default orange accent. Final micro-tuning happens in Phase 0 against real cards.
- **Links vs attachments are visually distinct** (external-link icon vs paperclip + filename) — separate entities with different security models (§6); file size shows in the attachment detail, not the timeline chip.
- **Screens are designed just-in-time per phase** (timeline done; setup → Phase 1, branding/members → Phase 2, share page → Phase 6), not all upfront.

## 5. Data model

Better Auth owns `user`, `session`, `account`, `verification` and provides the organization/member/invitation primitives. BragBit models the **workspace** as the umbrella tenant over those, plus the brag domain:

```
workspaces       id, type (personal|organization), name, slug?, logo_key?,
                 accent_color?, created_at, updated_at
                 -- private-* modes: exactly one row. hosted: many.
                 -- personal: exactly one member (owner); invite/member UI suppressed.

members          user_id FK, workspace_id FK, role (owner|admin|member), created_at
                 -- exactly one owner per workspace; ownership transfer is atomic

invitations      id, workspace_id FK, email, role (admin|member), token (unique),
                 invited_by FK, expires_at (+7d), accepted_at?, created_at
                 -- organizations only; single-use; re-invite revokes prior token

instance_admins  user_id FK   -- hosted mode only: superadmin(s); seeded via env/CLI

profiles         user_id PK/FK, display_name, role_title, team, bio, avatar_key,
                 reminder_enabled, reminder_day, timezone

documents        id, workspace_id FK, user_id FK, title, description?,
                 period_start?, period_end?, goals_md?, archived_at?, created_at, updated_at
                 -- a document = a review period ("2026", "H1 2026", "Promo case")
                 -- archived_at: archive drops it from the dashboard without deleting

brags            id, document_id FK, title, description_md?, impact_md?,
                 date (default today), category?, status? (shipped|in_progress),
                 visibility (shared|private, default shared),
                 collaborators text[]?, attribution?,
                 search tsvector (generated), created_at, updated_at

brag_links       id, brag_id FK, url, label?, position
attachments      id, brag_id FK, storage_key, file_name, mime_type, size_bytes, created_at
tags             id, user_id FK, workspace_id FK, name             -- scoped per user per workspace (monochrome in v1; no color)
brag_tags        brag_id FK, tag_id FK (PK pair)

share_links      id, document_id FK, token (unique, 128-bit random),
                 password_hash?, revoked_at?, created_at, last_accessed_at?
```

**Workspace scoping is load-bearing:** every domain query filters by the caller's workspace membership; this is what isolates tenants in `hosted` mode and is enforced from day one even in single-workspace modes.

**Category taxonomy** (fixed list in code, optional per brag — merges Julia Evans' sections with BragBook's template; doubles as render-time sections for a structured review doc later):
`shipped-work · technical-contribution · collaboration-mentoring · leadership · recognition-feedback · skills-learning · glue-process-work · other`

## 6. Architecture & file structure

### Runtime architecture

- **App structure:** App Router. `/setup` (first-run wizard, private modes only); `(auth)/` for sign-in, **open signup (hosted only)**, invitation acceptance, password reset; authenticated app under `(app)/` (dashboard, documents, brag editor, profile, settings, workspace switcher); workspace admin under `(app)/admin` (role-gated); instance superadmin under `(app)/super` (hosted, superadmin-gated); public share view under `share/[token]`. Mutations via Server Actions validated with Zod; uploads/downloads and share access via Route Handlers.
- **`INSTANCE_MODE` behavior:**
  - `private-org` → all routes redirect to `/setup` until an organization workspace exists; wizard creates org + owner (SMTP test, optional `SETUP_TOKEN`); then `/setup` is permanently disabled. No public signup; growth via invitations only.
  - `private-solo` → `/setup` creates a single **personal** workspace + owner; no invitation/member UI anywhere; otherwise identical app.
  - `hosted` → no setup wizard; **open signup** (email verification required) creates a personal workspace per user; any user can later create an organization workspace and invite a team; first instance superadmin seeded via env/CLI.
- **Invitation flow (organizations):** admins create invitations; invitee gets a branded tokenized email; the registration form is reachable only with a valid, unexpired, unused token and binds the account to the invited email. Email verification is satisfied by construction for invitees (they registered via a link sent to that address).
- **Open signup (hosted only):** email+password with required verification as the gate; signup rate-limiting and per-workspace storage quotas bound abuse. Disposable-email domains are **blocked by default** (`BLOCK_DISPOSABLE_EMAIL`, on; env-toggle off); per-workspace storage quota defaults to **2 GB** (`WORKSPACE_QUOTA_MB=2048`). OAuth (if configured) may create a personal workspace in `hosted` mode; in private modes OAuth only signs in already-provisioned accounts.
- **Roles & permissions:** Owner = workspace creator (setup user, or org creator in hosted); transferable; not demotable/removable by admins. Admins manage branding, members, invitations. Members use the product. **Admins manage the workspace, never members' brag content** — brags are private per user regardless of role. The hosted **instance superadmin** manages workspaces/users/quotas for abuse control and likewise never reads brag content.
- **White-labeling:** name/logo/accent stored on `workspaces`; logo via storage adapter; accent as a validated hex applied through CSS custom properties (Tailwind theme tokens) at the root layout — login, app chrome, share pages, and all emails render the active workspace's branding. Share pages keep a small "Powered by BragBit" footer.
- **Storage adapter:** one interface (`put/get/delete/stream`); `LocalDiskStorage` (default, `STORAGE_DIR` volume) and `S3Storage` (any S3-compatible endpoint), selected by `STORAGE_DRIVER`. Keys are prefixed per workspace (isolation + quota accounting). Attachments are **never** publicly addressable — streamed through an authorizing route (owner session, or valid share token for shared brags). Org logos and avatars are the deliberate public exceptions.
- **Sharing security:** token = 16+ random bytes, base64url. Revoke = rotate/delete row. Optional password checked against argon2 hash, success stored in an httpOnly cookie scoped to that share; rate-limit attempts. Share queries filter `visibility = 'shared'` at the query layer so private brags never leak into shared views or exports. Share links work for anyone with the URL (read-only, no login).
- **Data isolation:** a membership-guard helper wraps every workspace-scoped query; cross-workspace access returns 404. A dedicated test suite (added with `hosted`) asserts no workspace can read another's documents, brags, attachments, search results, or share links.
- **Search:** Postgres FTS — generated `tsvector` over title/description/impact, GIN index, searched across the caller's documents **within the active workspace**.
- **Email:** required infrastructure (verification, invitations, password reset, reminders). Nodemailer + SMTP env config, React Email templates, workspace-branded. Reminder scheduler: `node-cron` from `instrumentation.ts` in the standalone server (Docker); external cron hitting a secured route as the serverless fallback.
- **Export:** Markdown first (string assembly, high-trust). PDF via a print-optimized view + optional headless Chromium (`puppeteer-core` against a `browserless/chromium` compose service); graceful fallback to browser print. Exports carry workspace branding.
- **Instance config:** `INSTANCE_MODE`, `SETUP_TOKEN`, `BLOCK_DISPOSABLE_EMAIL`, `WORKSPACE_QUOTA_MB`, SMTP, storage, OAuth, upload limits — all via env, documented in `.env.example`.

### Layering (the file structure is a security decision)

Three rules:
1. **`app/` is routing only** — thin files that gate access and delegate to a feature; no business logic, no inline DB queries.
2. **Code lives in feature modules** grouped by domain (`brag`, `document`, `workspace`, `share`), not by technical type — cohesion over parallel `components/`+`actions/` trees.
3. **One hard boundary — the Data Access Layer (DAL).** Every DB read/write passes through guards (`requireSession` / `requireWorkspace` / `requireRole`) that verify session **and** workspace membership; nothing outside the DAL imports the Drizzle client. This is what makes tenant isolation airtight in `hosted` mode.

**Authorization lives in the DAL and server components/layouts, never in middleware** (per Next.js security guidance — middleware does optimistic cookie/mode redirects only). `import 'server-only'` on `lib/db` and queries keeps DB code out of client bundles.

**Import direction is one-way:** `app/` → `features/` → `lib/auth/guards` (the DAL gate) → `lib/db` · `lib/storage` · `lib/email`. Only the DAL gate reaches the database.

### File structure

```
bragbit/
├─ src/
│  ├─ app/                              # ROUTING ONLY — thin files
│  │  ├─ layout.tsx                     # <html>, theme + active-workspace brand CSS vars
│  │  ├─ globals.css                    # Tailwind v4 tokens (the "logbook" palette)
│  │  ├─ setup/                         # first-run wizard (private-org / private-solo)
│  │  ├─ (auth)/                        # sign-in, reset-password, verify-email,
│  │  │                                 #   sign-up (mounts only when instance.allowsSignup()),
│  │  │                                 #   invite/[token] (accept org invitation)
│  │  ├─ (app)/                         # authenticated + workspace-scoped
│  │  │  ├─ layout.tsx                  # requireSession() → active workspace → branding
│  │  │  ├─ dashboard/
│  │  │  ├─ documents/[documentId]/     # the month-grouped timeline
│  │  │  ├─ profile/ · settings/
│  │  │  ├─ admin/{branding,members}/   # workspace owner/admin (gated in layout)
│  │  │  └─ super/                      # instance superadmin (hosted only)
│  │  ├─ share/[token]/                 # PUBLIC read-only (no session)
│  │  └─ api/                           # Route Handlers (thin)
│  │     ├─ auth/[...all]/              # Better Auth
│  │     ├─ upload/ · files/[...key]/   # multipart in · authorizing stream out
│  │     ├─ export/[documentId]/
│  │     └─ cron/reminders/             # secured external-cron fallback
│  │
│  ├─ features/                         # DOMAIN MODULES — most code lives here
│  │  ├─ brag/        components/  actions.ts  queries.ts  schema.ts
│  │  ├─ document/    components/  actions.ts  queries.ts  schema.ts
│  │  ├─ workspace/   components/  actions.ts  queries.ts  schema.ts   # members, invites, branding
│  │  ├─ share/       components/  actions.ts  queries.ts  schema.ts
│  │  ├─ timeline/    components/                                       # month grouping, filters
│  │  ├─ auth/ · setup/ · export/ · reminder/ · superadmin/
│  │
│  ├─ components/
│  │  ├─ ui/                            # shadcn primitives
│  │  └─ shared/                        # app-wide composite components
│  │
│  ├─ lib/                              # INFRASTRUCTURE — no business logic
│  │  ├─ db/
│  │  │  ├─ index.ts                    # drizzle(postgres) client — import 'server-only'
│  │  │  ├─ schema/  auth.ts workspace.ts document.ts brag.ts share.ts index.ts
│  │  │  └─ migrations/                 # drizzle-kit output
│  │  ├─ auth/
│  │  │  ├─ index.ts                    # betterAuth() + organization plugin
│  │  │  ├─ client.ts                   # client-side hooks
│  │  │  └─ guards.ts                   # requireSession / requireWorkspace / requireRole  ← DAL gate
│  │  ├─ storage/  index.ts (interface + factory)  local.ts  s3.ts
│  │  ├─ email/    client.ts (nodemailer)  send.ts
│  │  ├─ env.ts                         # Zod-validated process.env (fails fast at boot)
│  │  ├─ instance.ts                    # INSTANCE_MODE helpers: allowsSignup(), isHosted()…
│  │  └─ utils.ts
│  │
│  └─ emails/                           # React Email templates (invitation, verify, reminder…)
│
├─ tests/                               # Playwright e2e; unit tests colocated as *.test.ts
├─ docs/                                # self-hosting · configuration · instance-modes · admin/user guides
├─ .github/                             # issue + PR templates, CODEOWNERS, CI workflows
├─ README.md · CHANGELOG.md · LICENSE   # Keep a Changelog · AGPL-3.0
├─ CONTRIBUTING.md · CODE_OF_CONDUCT.md · SECURITY.md
├─ drizzle.config.ts
├─ middleware.ts                        # LIGHT: cookie presence + mode redirects only — no real authz
├─ instrumentation.ts                   # node-cron reminder scheduler (standalone server)
├─ docker-compose.dev.yml               # Postgres + MinIO + Mailpit
├─ docker-compose.yml · Dockerfile      # prod: app + Postgres (+ optional MinIO, chromium)
├─ components.json                      # shadcn config
├─ next.config.ts                       # output: 'standalone' (Docker-first)
└─ .env.example
```

### Key structural decisions

- **`src/` + thin route files** — routing ≠ logic; a `page.tsx` reads via a feature `queries.ts` and renders, never writes SQL.
- **Feature-modular** — everything for a domain (UI, actions, queries, Zod schema) in one folder; scales better than layer-only trees.
- **DAL is the security model** — authz in the data layer and server components, not middleware; `server-only` guarantees no DB code in client bundles.
- **Server Actions for mutations, Route Handlers for HTTP** — forms call `'use server'` actions validated by Zod at the boundary (consider `next-safe-action` / `zsa` for typed ergonomics); Route Handlers only for Better Auth, upload, file streaming, export, cron.
- **Drizzle schema split by domain**, drizzle-kit migrations run on container start so a fresh deploy self-provisions.
- **`INSTANCE_MODE` centralized in `lib/instance.ts`** — the same tree serves all three modes; mode only decides which routes mount and which setup path runs.
- **Storage as a Strategy adapter** behind one interface; **`output: 'standalone'` + `instrumentation.ts`** for the Docker-first / Dokploy story.

### References

Official docs (the spine):
- **Next.js** — Project Organization & File Colocation; Server Actions and Mutations; Route Handlers; Authentication; the **"How to Think About Security in Next.js"** Data Access Layer + DTO guidance (the basis for `guards.ts`); `instrumentation.ts`; `output: 'standalone'`.
- **Better Auth** — Drizzle adapter, Organization plugin, Next.js integration, Email & Password / Email verification.
- **Drizzle ORM + drizzle-kit** — schema, relations, the `schema/` + `migrations/` layout.
- **shadcn/ui** — `components.json` + `components/ui` + CSS-variable theming; **Tailwind v4** CSS-first tokens.
- **Zod**, **React Email + Nodemailer**, **`@aws-sdk/client-s3`** (presigned URLs, path-style for MinIO).

Architecture patterns (the shape):
- **bulletproof-react** (feature-modular structure), **Feature-Sliced Design** (layering / one-way imports), **create-t3-app** (end-to-end type safety), **Better-T-Stack** (a concrete Better Auth + Drizzle + Next.js reference scaffold).

### Performance & Core Web Vitals

Targets: LCP < 2.5s, INP < 200ms, CLS < 0.1 — enforced by Lighthouse CI budgets in the pipeline.

- **Server-first rendering.** Timeline and document views are Server Components streamed via Suspense + `loading.tsx`; Client Components are interactive islands only (quick-add, filters, markdown editor, accent picker). Heavy deps (markdown editor, PDF) are `next/dynamic` so they stay out of the initial bundle.
- **Tenant-safe caching.** Per-request memoization (React `cache`) + `revalidateTag` after mutations. Cache keys **always include workspace + user** — caching is a tenant-isolation boundary here, not just speed. Public share pages (read-only) cache by token and invalidate on edit/revoke; password-protected shares are never cached.
- **Database.** Indexes on every FK plus `brags(document_id, date)` (timeline order), GIN on the search `tsvector`, `members(user_id, workspace_id)` (the guard hot-path), unique `share_links(token)`. Relational/batched loads to avoid N+1 on tags/links/attachments; Postgres connection pool.
- **Timeline at scale.** A year-long document can hold hundreds of brags → cursor pagination by date (month-windowed loading); attachments never fetched eagerly.
- **Assets.** `next/image` for image attachments with server-generated thumbnails (timeline shows thumbnails, not full-res); self-hosted fonts via `next/font` (subset Fraunces + IBM Plex, no layout shift); ranged streaming for file downloads.
- **Monitoring (self-host-friendly).** `useReportWebVitals` posts Web Vitals to an optional internal endpoint (no Vercel-Analytics dependency); bundle-size budget (`size-limit` / `@next/bundle-analyzer`) gates PRs.

*Field note (June 2026): the incumbent's client-rendered SPA is slow to render — authenticated sub-pages (Share, Integrations, Account) sit on loading skeletons for several seconds before content appears — a perceived-performance gap our server-first rendering directly targets.*

## 7. Documentation

Documentation is a first-class deliverable, written alongside the code — not deferred to release. Decisions: **repo-native markdown** (`README` + `/docs`), **Keep a Changelog + SemVer**, **Conventional Commits enforced**.

### Repo-root documents
- `README.md` — the front door: one-line pitch, hero screenshot, the three modes, feature highlights, a 5-minute quick start (Dokploy + Docker Compose), links into `/docs`, and badges (CI, license, release) + a demo link when available.
- `CHANGELOG.md` — Keep a Changelog format, SemVer. An `[Unreleased]` section is updated in every feature/fix PR (Added / Changed / Fixed / Removed / Security); on release it is promoted to a dated version heading.
- `CONTRIBUTING.md` — local dev setup, the Docker dev stack, branch & PR workflow, the Conventional Commits spec with examples, how to run tests/lint/typecheck, and how to add a changelog entry.
- `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1.
- `SECURITY.md` — supported versions and a private vulnerability-disclosure process (career data is sensitive — coordinated disclosure, never public issues).
- `LICENSE` — AGPL-3.0.
- `.github/` — issue templates (bug, feature, config), a PR template (checklist incl. "updated CHANGELOG / docs"), `CODEOWNERS`, and CI workflows.

### `/docs` (operator · user · contributor guides)
- `docs/self-hosting/` — deployment guides: **Dokploy** (the reference), generic Docker Compose, and a Vercel + managed-Postgres variant; plus backup/restore and upgrade notes.
- `docs/configuration.md` — the full environment-variable reference (`INSTANCE_MODE`, `SETUP_TOKEN`, SMTP, storage driver + S3, OAuth, `BLOCK_DISPOSABLE_EMAIL`, `WORKSPACE_QUOTA_MB`, upload limits).
- `docs/instance-modes.md` — `private-org` vs `private-solo` vs `hosted`, with the workspace/tenancy model explained for operators.
- `docs/admin-guide.md` — workspace owner/admin tasks (branding, members, invitations) and the hosted instance-superadmin console.
- `docs/user-guide.md` — using BragBit: documents, the quick-add flow, tags, sharing, export.
- `docs/architecture.md` — the layering, file structure, and DAL boundary (kept in sync with §6).
- `docs/api.md` — REST API reference (added with the v2 API).
- Screenshots/diagrams under `docs/assets/`.

### Tooling & enforcement
- **Conventional Commits** enforced by `commitlint` + a git hook (`lefthook`/Husky); PR titles follow the convention for squash merges.
- **Markdown quality** in CI: `markdownlint` + a link checker (`lychee`) over `README` and `/docs`; Prettier formats markdown.
- **PR template checklist** includes "updated `CHANGELOG.md [Unreleased]`" and "updated relevant `/docs`"; a light CI check flags app-code PRs that touch neither.

### Release process
SemVer. On release: promote `[Unreleased]` → a dated `vX.Y.Z` section, tag the commit, and publish GitHub release notes from that section. `0.x` until the modes and API stabilize; `1.0.0` once the hosted mode and core are stable.

## 8. Phases & todos

*Definition of done for every phase: user-facing changes are reflected in `/docs` and the `CHANGELOG.md [Unreleased]` section before the phase is considered complete.*

### Phase 0 — Foundation

> **Status: complete (2026-06-13).** Scaffold, design system, repo foundation, data layer, email, dev tooling, and CI are all in place and verified locally. One carry-over: the Zod form↔action validation pattern + toast conventions, which land with the first forms in Phase 1.

- [x] `git init`, **AGPL-3.0 `LICENSE`**, and the root documentation skeleton: `README` stub, `CHANGELOG.md` (`[Unreleased]`), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `.github/` issue + PR templates
- [x] `/docs` skeleton — stub pages: `self-hosting/`, `configuration.md`, `instance-modes.md`, `admin-guide.md`, `user-guide.md`, `architecture.md` (filled in per-phase as features land)
- [x] Conventional Commits enforcement: `commitlint` + a `lefthook`/Husky git hook
- [x] Scaffold Next.js (TypeScript, App Router, Tailwind v4), ESLint + Prettier
- [x] shadcn/ui setup (lucide-react for all icons), base layout, **light-only paper palette** (dark variant deferred — see Design system §4), accent-color CSS-variable theming, all **8 category color tokens**
- [x] Adopt the "engineering logbook" design language from `design-mockup.html` (Fraunces + IBM Plex, paper palette, month-grouped timeline) as the component baseline
- [x] Drizzle + drizzle-kit wired to Postgres; **workspace-scoped schema conventions** established; `docker-compose.dev.yml` (Postgres + MinIO + Mailpit)
- [x] Email infrastructure: Nodemailer + SMTP env + React Email base template (workspace-brandable)
- [x] `INSTANCE_MODE` env + a typed config module guarding mode-specific behavior
- [x] Zod + shared validation pattern; error/toast conventions — _the setup form & action share `setupSchema`; `sonner` toasts wired in the root layout_
- [x] CI (GitHub Actions): typecheck, lint, build, test; Vitest + Playwright skeletons; **Lighthouse CI + bundle-size budget** (Core Web Vitals gates); markdownlint + link-check (`lychee`)

### Phase 1 — Workspaces, auth & membership *(v1)*

> **Status: complete (2026-06-13).** Auth, workspaces & membership are in place for the private modes — the setup wizard, invitation + accept flow, required verification + password reset, optional GitHub/Google OAuth, the DAL membership guard, active-workspace resolution on sign-in, profile + avatar (with `LocalDiskStorage`), account settings, the invitation/mode test suite, and the Phase 1 `/docs`. Hosted-only pieces (open signup, user-created orgs, superadmin) are Phase 10; the in-app admin invite/branding/member UI is Phase 2.

- [x] Better Auth + Drizzle adapter + organization plugin; model `workspace` (type `personal`|`organization`) as the tenant umbrella
- [x] `/setup` first-run wizard (private modes): `private-org` → org workspace + owner (SMTP test, optional `SETUP_TOKEN`); `private-solo` → personal workspace + owner (no invite UI). Wizard disabled once a workspace exists; all routes redirect to it before then
- [x] Invitation flow (organizations): admin invites email + role → branded tokenized email (7-day, single-use) → registration bound to invited email → member/admin created — _invite email + accept flow built & verified end-to-end; the admin invite UI lands in Phase 2_
- [x] **Required email verification** (satisfied by invite link for invitees); password reset — _verification enforced + sign-in / forgot-password / reset / verify-email pages; the invitee-link-satisfies-verification part lands with invitations_
- [x] Optional GitHub/Google OAuth via env — sign-in for existing accounts in private modes; may create a personal workspace in `hosted` — _`socialProviders` configured only when a provider's id+secret are set; account linking lets a verified user attach an identity; `disableSignUp` in private modes blocks creating a new user from an unrecognized OAuth identity (hosted account-→-workspace provisioning lands in Phase 10). Sign-in page shows a provider button only when configured; verified the GitHub authorize-URL wiring + the no-creds path._
- [x] Membership-guard helper for workspace-scoped queries (the isolation foundation)
- [x] Resolve the active workspace on sign-in — set `session.activeOrganizationId` so `requireWorkspace` works after a plain sign-in (trivial for `private-solo`: the user's sole membership). _Done via a `databaseHooks.session.create.before` hook that pins the caller's earliest membership; verified a plain email/password sign-in now lands a session with the active org set._
- [x] Profile: display name, role title, team, bio, avatar upload (build `LocalDiskStorage` here) — _`profiles` table + feature module; `LocalDiskStorage` (put/get/delete/stream, traversal-guarded) behind the storage adapter (`S3Storage` deferred to Phase 4); avatar upload route + an authorizing `/api/files/[...key]` stream (avatars-only, membership-gated in Phase 1). `display_name` mirrors to Better Auth `user.name`._
- [x] Account settings: change email/password (re-verify on email change), delete account (cascades own data) — _Better Auth `changeEmail` (verified users confirm from their current inbox), `changePassword` (revokes other sessions), and `deleteUser` with a `beforeDelete` that also drops the sole-member workspace and the avatar file (neither cascades from the user row)._
- [x] Tests: invitation expiry/reuse, registration impossible without a valid token (private-org), personal mode exposes no invite/member surface — _the security predicates are extracted pure and unit-tested (CI runs Vitest without a DB): `isAcceptableInvitation` (expiry + single-use, wired into the accept-page query) and `modeCapabilities` (private-org has no open signup → invite-token-only registration; private-solo hides the invite/member surface; hosted opens signup)._
- [x] Write up the Phase 1 `/docs` before closing the phase: `user-guide` (sign-up / verify / sign-in / password reset), `admin-guide` (invitations), `architecture` (auth + the DAL guards) — _`user-guide` covers getting in (sign-in, OAuth, verification, reset) + profile/account; `admin-guide` covers roles + the invitation model (noting the admin UI is Phase 2); `architecture` documents the Better Auth + workspace/tenancy model, the active-workspace session hook, OAuth, and the two DAL guard flavors._

### Phase 2 — Workspace administration & white-labeling *(v1)*

> **Status: complete (2026-06-13).** Admin area + branding (2.1), members management + branded emails (2.2), and member removal + ownership transfer + role-gating tests (2.3) are all in. The one open checkbox — branding on **share pages** + the "Powered by BragBit" footer — is inherently Phase 6 (share pages don't exist yet); the export bundle for member removal joins when export ships (Phase 7).

- [x] Admin area (`/admin`, owner+admin): workspace settings — name, logo upload, accent color picker (validated hex, live preview) — _slice 2.1: role-gated `/admin`; branding form (name + accent picker with live preview) updates the org row through a DAL action; logo upload via `/api/upload/logo` (owner/admin) stored under the workspace `branding/` prefix and served publicly by `/api/files/[...key]` (logos are the public exception; avatars stay session-gated)._
- [ ] Branding applied across login, app chrome, share pages, and all email templates; "Powered by BragBit" footer on share pages — _slice 2.1 applied accent + logo + name to the app chrome and the login page (per-workspace `--primary`/`--ring` override on the layout wrapper); slice 2.2 branded all email templates — invitations use the inviting org's brand, transactional emails (verify / reset / change-email) use the instance brand via `lib/branding`. Remaining: share pages + the "Powered by BragBit" footer (Phase 6)._
- [x] Personal-workspace UX: hide member/invite/role chrome; expose profile + light personalization (display name, avatar, optional accent) — useful for a freelancer's client-facing share pages — _a personal-workspace owner sets name + accent + logo from `/admin` (profile + avatar shipped in Phase 1); the Members tab and `/admin/members` are hidden/blocked for personal workspaces (gated on `workspace.type`), verified in slice 2.2._
- [x] Members management (organizations): list with roles + last activity; invite (single + multiple); pending invitations (resend/revoke); change role; **remove member = export-then-delete** (member gets a portable Markdown + JSON + attachments bundle, then their data is purged from the workspace; full offboard in `private-org`) — _slice 2.2 built `/admin/members` (org only): list with role + joined + last-active, invite one or more emails with a role, pending resend/revoke, change role. Slice 2.3 added **remove member** (membership purge via Better Auth; owner & self protected). The export bundle + full account offboard attach when export ships (Phase 7) — there's no brag data until Phase 3._
- [x] Ownership transfer (owner only); admins can never demote/remove the owner — _slice 2.3: an owner-only action atomically swaps roles (target → owner, current owner → admin) in a transaction, keeping exactly one owner; verified live._
- [x] Tests: role-gating on every admin action; member cannot reach admin routes — _slice 2.3: a pure `roles` policy (`canAdminister` / `canManageMember` / `canTransferOwnershipTo`) is unit-tested and drives the admin gate + members UI; the actions enforce it via `requireRole` and Better Auth. A Playwright e2e (DB seeded by `globalSetup` via `better-auth/crypto`) asserts a member is redirected off `/admin` and an owner reaches it. CI now provisions a Postgres service for the e2e + Lighthouse jobs, so they exercise a real database (previously DB-less); the Vitest job stays DB-free for the pure unit tests._

### Phase 3 — Core domain: documents & brags *(v1)*

> **Status: in progress.** Slices 3.1 (schema + Documents CRUD + the `/dashboard`
> listing) and 3.2 (brags CRUD, the <30s quick-add, the full editor with Markdown,
> the per-document page + empty-state onboarding) are done and committed. Remaining:
> multiple links per brag with labels (slice 3.3). The month-grouped timeline, tags,
> filters, and search stay in Phase 5; the per-brag visibility toggle is Phase 6.

- [x] Drizzle schema + migrations for `documents`, `brags`, `brag_links`, `tags`, `brag_tags` (all workspace-scoped) — _slice 3.1: the full Phase 3 schema shipped in one migration (`0002`). Documents are workspace + user scoped; brags are scoped through their parent document (no direct workspace column); tags are unique per (user, workspace, name). The generated `search` tsvector + its GIN index are deferred to Phase 5 (FTS)._
- [x] Documents CRUD: create (title + optional period + goals), edit, archive/delete; dashboard listing the workspace's documents for the user — _slice 3.1: `features/document` (Zod schema, DAL-guarded queries, server actions that enforce ownership + workspace in the `WHERE`). `/dashboard` lists the caller's documents with create/edit in a dialog, **reversible** archive (a restorable "Archived" disclosure), and delete (cascades the document's brags). Sign-in / setup / invite-accept now land on `/dashboard`._
- [x] Brags CRUD via server actions — ownership + workspace checks on every mutation — _slice 3.2: `features/brag` — queries scoped through the parent document (join); actions enforce ownership in the `WHERE` (creates resolve the owned document first; updates/deletes use a correlated `EXISTS` on it)._
- [x] **Quick-add flow (the product's soul):** only title required, date defaults to today; everything else optional; target < 30s; keyboard shortcut (`n`) and inline add from timeline — _slice 3.2: a quick-add bar on the document page logs a brag from a title alone (the client stamps today's date); `n` focuses it from anywhere; "Add with details" opens the full editor. (The brag list is a simple reverse-chron list for now; the month-grouped timeline is Phase 5.)_
- [x] Form placeholders teach the formula: *"What you did + why it mattered + the measurable result"* with the 40%→28% example — _slice 3.2: the formula line under the quick-add bar and the description placeholder (the 40%→28% checkout example)._
- [x] Impact field, category select, status, collaborators, attribution (recognition brags) — _slice 3.2: all in the editor; category is the fixed 8-color taxonomy, collaborators a comma-separated list stored as `text[]`._
- [ ] Multiple links per brag with labels
- [x] Markdown editor for description/impact (edit/preview), sanitized rendering — _slice 3.2: a Write/Preview Markdown field (react-markdown + remark-gfm, safe by default — no raw HTML, dangerous URLs stripped); rendered server-side in cards (zero client JS) and lazy-loaded for the editor preview. The bundle budget was raised 350→400 kB to fit the renderer._
- [x] Empty-state onboarding: *"Start by back-filling three wins from the past month"* — _slice 3.2: shown on a document with no brags yet._

### Phase 4 — Attachments & storage adapter *(v1)*
- [ ] Add `S3Storage` (S3-compatible endpoint, path-style for MinIO); driver via env; per-workspace key prefixes
- [ ] Upload route handler: multi-file, size/MIME limits from env, image/PDF/doc types
- [ ] Attachment list on brag (server-generated `next/image` thumbnails for images, file chips otherwise); delete; download
- [ ] Authorizing download/stream route (owner or valid share token only — never public URLs); ranged responses for large files
- [ ] Adapter tests against MinIO in CI

### Phase 5 — Timeline, tags & search *(v1)*
- [ ] Document timeline view: reverse-chronological, **grouped by month** with sticky month headers; cards show title, date, category badge, tags, impact highlight, attachment/link indicators
- [ ] Card rendering details: 8 category colors (label-paired); **timeline node = status only** (solid accent = shipped · hollow = in-progress) + an "In progress" pill; **private = card treatment** (dashed border + hatch + "Private" badge), not a node ring; links (external-link icon) vs attachments (paperclip + filename) as distinct chips (size in the detail view)
- [ ] Cursor pagination by date (month-windowed loading) so year-long documents stay fast; DB indexes for timeline order + FTS
- [ ] Expand card → full brag detail (rendered markdown, attachments, links, collaborators)
- [ ] Tags: inline create while editing, scoped per user per workspace, **monochrome `#text` chips** (calm logbook style)
- [ ] Filter timeline by tag, category, date range; visible gap months
- [ ] Global search across the user's documents within the workspace (Postgres FTS), deep-linking into documents
- [ ] Responsive + keyboard-friendly; polish loading/empty/error states

### Phase 6 — Sharing *(v1)*
- [ ] `share_links` schema; create/revoke(rotate) from a share dialog; copy-link UX
- [ ] Public read-only view at `/share/[token]`: workspace-branded timeline, attachments, links — clean, manager-presentable, "Powered by BragBit" footer
- [ ] Optional password: set/remove, argon2 hash, unlock form, httpOnly cookie per share, rate-limited attempts
- [ ] **Per-brag visibility:** private toggle; filtered at the query layer; visible-only-to-you styling for the owner
- [ ] `noindex` on share pages; `last_accessed_at` shown to owner
- [ ] Tests: revoked token 404s, private brags absent from share payloads/exports, password flow

### Phase 7 — Export *(v1)*
- [ ] Markdown export per document: metadata + goals, then brags grouped by month (or category), markdown links, attachment manifest
- [ ] Print-optimized export view (workspace logo header, clean typography, page breaks between months)
- [ ] PDF export via optional headless-Chromium service; graceful fallback to browser print
- [ ] "Include private brags?" choice (owner-only, default off)
- [ ] JSON export of all the user's data (full portability)

### Phase 8 — Email reminders *(v1)*
- [ ] Opt-in weekly reminder per user: day-of-week + timezone; *"What did you ship this week?"* with quick-add deep link; workspace-branded
- [ ] `node-cron` scheduler in `instrumentation.ts`; secured route-handler trigger as external-cron fallback
- [ ] Settings UI + one-click unsubscribe in the email

### Phase 9 — Open-source & self-host readiness *(v1 release)*
- [ ] Production `Dockerfile` (multi-stage, Next standalone) + `docker-compose.yml`: app + Postgres (+ optional MinIO, chromium) — **one `docker compose up`**
- [ ] Migrations run automatically on container start
- [ ] `.env.example` documenting every variable (incl. `INSTANCE_MODE`, `SETUP_TOKEN`); first-run = setup wizard
- [ ] Finalize `/docs`: self-hosting guides (Dokploy reference + Compose + Vercel/Neon), `configuration.md` env reference, `instance-modes.md`, admin + user guides, backup/restore & upgrade notes
- [ ] Polish `README` (hero, screenshots, 5-minute quick start, demo link); verify `CONTRIBUTING` / `CODE_OF_CONDUCT` / `SECURITY` / `.github` templates are complete (scaffolded in Phase 0)
- [ ] Security hardening: headers, rate limits on auth + invitation + share-password routes, upload validation, dependency audit
- [ ] Demo seed script (demo workspace + user + sample "2026" document)
- [ ] Cut **`v0.1.0`**: promote `CHANGELOG.md [Unreleased]` → dated `0.1.0` section, tag the commit, publish GitHub release notes; make the repo public

### Phase 10 — Hosted multi-tenant mode *(v1.1 fast-follow)*
- [ ] `INSTANCE_MODE=hosted`: **open signup** page with required email verification; each signup → a personal workspace
- [ ] **User-created organizations:** any user can create an org workspace (becomes owner) and invite a team — reuses the Phase 1–2 invitation/admin/branding flows
- [ ] Workspace switcher for users in multiple workspaces (personal + orgs)
- [ ] **Instance superadmin** (`/super`, seeded via env/CLI): list/suspend workspaces & users, view signups, set per-workspace storage quotas — never exposes brag content
- [ ] Abuse controls: signup rate-limiting, per-workspace storage quota enforcement (default 2 GB, `WORKSPACE_QUOTA_MB`), disposable-email blocking on by default (`BLOCK_DISPOSABLE_EMAIL`)
- [ ] Per-workspace branding verified on a shared instance (orgs self-brand; personal uses instance default)
- [ ] **Data-isolation test suite:** cross-workspace access to documents/brags/attachments/search/share-links must fail
- [ ] Docs: "Hosting BragBit publicly" (the Dokploy public-instance guide), quota/abuse tuning
- [ ] Tag the `hosted` release

### Phase 11 — v2 backlog (explicitly later)
- [ ] REST API + personal access tokens → CLI/shell-alias/Slack-bridge capture (the community's strongest pattern)
- [ ] Companion CLI: extract candidate brags from local git history (optionally via Ollama, privacy-preserving), POST drafts for per-entry approve/edit/skip
- [ ] SSO (OIDC/SAML) for organization workspaces
- [ ] Optional BYO-API-key AI (Anthropic/OpenAI/Ollama): "enhance this note", "draft self-review from a date range" — strictly optional
- [ ] Curated sharing (hand-picked subset — the "strongest 3–5 accomplishments" pattern); org-internal shares (logged-in members only)
- [ ] Move/copy a document between workspaces (e.g., a freelancer's personal document into an org they later join) — the deferred personal↔org linking
- [ ] Entry content templates — action-verb scaffolds (Led Initiative, Fixed Critical Issue, Built System…) that pre-fill the brag form to beat the blank page (cheap; can be pulled into the Phase 3 editor)
- [ ] Streak + GitHub-style monthly activity heatmap on the dashboard to drive logging cadence (pairs with the reminder emails in Phase 8)
- [ ] Drafts as a first-class state — Save-as-Draft + a Drafts view, distinct from published brags (touches the Phase 3 brag model — design the `status` field with this in mind)
- [ ] Timeline pivots: group by category/quarter → structured 7-section review document
- [ ] Link expiration on share links; import from Markdown/Notion/Google Docs brag docs
- [ ] GitHub/Jira/Linear OAuth import (approve-each-entry UX, source deep links)
- [ ] Full white-label toggle (remove "Powered by BragBit") if orgs ask
- [ ] (If the hosted instance grows) billing / paid tiers — out of scope until then

## 9. Non-goals (v1 / v1.1)

- Manager dashboards, review workflows, performance analytics — admins/superadmins manage workspaces, never members' content.
- **Billing / paid tiers / entry caps** — the hosted instance is free; no payment system in v1 or v1.1.
- Hard AI dependency — the app must be fully useful with zero AI configured.
- Native mobile apps (responsive web only).
- Cross-workspace data sharing or org hierarchies beyond the flat owner/admin/member model.

## 10. Resolved decisions (formerly open)

All planning open-questions are now decided:
- **Member removal → export-then-delete.** A removed member receives a portable export (Markdown + JSON + attachments); their data is then purged from the workspace. Nothing orphaned (admins can't read brag content), nothing silently destroyed.
- **Disposable-email blocking (hosted) → on by default.** `BLOCK_DISPOSABLE_EMAIL` defaults on (maintained blocklist), disable-able via env; required email verification still applies on top.
- **Per-workspace storage quota (hosted) → 2 GB default.** `WORKSPACE_QUOTA_MB=2048`, env-tunable.
- **Personal ↔ org linking → deferred to v2** as a "move/copy a document between workspaces" feature. In v1.1, personal and org workspaces stay separate; a user may belong to both.
- **Public demo instance → deferred** until after `hosted` mode ships (v1.1); revisit then.

## 11. Success criteria

**v1 (self-host):**
1. `private-org`: an admin completes the setup wizard (name, logo, accent) and invites the first developer in under 5 minutes.
2. `private-solo`: a freelancer runs `docker compose up`, completes a minimal setup, and logs their first brag in under 2 minutes — never sees org/member chrome.
3. Adding a brag takes under 30 seconds.
4. A manager opens a share link on their phone and reads a clean, branded, month-grouped timeline — private brags invisible, no login required.
5. A user exports a document to Markdown and walks away with everything.
6. In `private-org`, nobody can create an account without an invitation — verified by tests.

**v1.1 (hosted):**
7. A freelancer signs up on our hosted instance, verifies their email, lands in a personal workspace, and logs their first brag — no admin involvement.
8. A user creates an organization on the hosted instance and invites a teammate, who joins successfully.
9. Data isolation is proven by tests: no workspace can read another workspace's data through any surface.

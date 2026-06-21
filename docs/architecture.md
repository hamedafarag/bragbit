# Architecture

Kept in sync with [PLAN.md](../PLAN.md) §6. This documents what's **built**; the
full target model and file structure live in PLAN §5–§6.

> **Status:** documented through Phase 8, plus the Phase 9 deployment stack —
> layering, authentication & tenancy, the DAL boundary, the data model, workspace
> administration & branding, the storage adapter, attachments, documents, the brag
> domain (timeline, tags, full-text search, filters, detail view), sharing (public
> links, passwords, the security invariants), export (Markdown, print/PDF, full-data
> JSON), reminders, and deployment (the standalone Docker image + Compose stack,
> migrations on container start).

## Layering (a security decision)

1. **`app/` is routing only** — thin files that gate access and delegate to a feature (plus the
   route state files: `loading.tsx` skeletons, an `(app)/error.tsx` boundary, and `not-found.tsx`).
2. **Code lives in feature modules** grouped by domain. Built so far: `features/auth`,
   `features/workspace`, `features/profile`, `features/invitation`, `features/setup`,
   `features/document`, `features/brag`, `features/attachment`, and `features/timeline`.
3. **One hard boundary — the Data Access Layer (DAL).** Every DB read/write passes through
   guards that verify session **and** workspace membership. Nothing outside the DAL imports
   the Drizzle client (`import 'server-only'` on `lib/db` keeps it out of client bundles).

Import direction is one-way: `app/` → `features/` → `lib/auth/guards` → `lib/db` · `lib/storage` · `lib/email`.

Authorization lives in the DAL and server components/layouts, never in middleware (which does
optimistic cookie/mode redirects only). The guards come in two flavors:

- **Redirecting** — `requireSession` / `requireWorkspace` / `requireRole` (Server Components,
  Server Actions).
- **Non-redirecting** — `getSessionOrNull` / `getWorkspaceOrNull` / `isWorkspaceMember` (Route
  Handlers, which answer with an HTTP status).

Both keep every membership lookup inside the DAL. Role decisions come from the pure, unit-tested
`features/workspace/roles` policy (`canAdminister` / `canManageMember` / `canTransferOwnershipTo`),
shared by the admin gate and the members UI; Better Auth re-enforces them server-side.

## Authentication & tenancy

Auth is **Better Auth**: email + password with **required email verification**, plus the
organization plugin. BragBit models a **workspace** as a Better Auth organization carrying a
`type` discriminator (`personal` | `organization`) — a freelancer is a personal workspace of one.
`INSTANCE_MODE` picks the deployment shape (see [Instance modes](instance-modes.md)); the per-mode
capability mapping is a pure function in `lib/instance-modes.ts`, bound to the runtime mode in
`lib/instance.ts` (and reused by `lib/env.ts` as the single source of the mode list).

- **Sessions & the active workspace.** A session row carries an `activeOrganizationId`. A Better
  Auth `session.create` hook resolves it on every sign-in (the caller's earliest membership), so
  `requireWorkspace()` works after a plain email/password sign-in — not only after the setup wizard
  or invitation acceptance, which set it explicitly. A signed-in session with **no accessible
  workspace** (e.g. a removed member who still has an account) is sent to a terminal `/no-workspace`
  page rather than looping through the root dispatcher.
- **Invitations** are tokenized, single-use, expire after `INVITATION_TTL_DAYS` (default 7), and bind
  registration to the invited email (acceptability is the pure, unit-tested `isAcceptableInvitation`);
  see the [Admin guide](admin-guide.md).
- **Invitation-only sign-up.** In the private modes accounts are created only by the setup wizard and
  invitation-accept, which call `auth.api.signUpEmail` server-side. The public `POST
/api/auth/sign-up/email` route is blocked in the catch-all auth handler (and OAuth uses
  `disableSignUp`), so a stranger can neither create an account nor make the instance relay a
  verification email; hosted mode keeps open sign-up.
- **OAuth (optional).** GitHub/Google are enabled per provider via env. Account linking lets a
  verified user attach an identity; in the private modes `disableSignUp` means OAuth only signs in
  already-provisioned accounts — it never creates one, preserving invitation-only.
- **Profiles.** A per-user `profiles` row (display name, role title, team, bio, avatar key; the
  reminder fields are reserved for Phase 8) is read/written through `features/profile`; the display
  name mirrors to Better Auth `user.name`.
- **Credentials.** Password hashes live in Better Auth's `account` table, never on `user`.

## Data model (so far)

Better Auth owns `user` / `session` / `account` / `verification`. The organization plugin provides
`organization` (= the workspace, plus BragBit's `type` / `accent_color` / `logo_key`), `member`,
and `invitation`. BragBit adds `profiles` and the brag domain: `documents` (workspace + user
scoped), `brags` (scoped through their parent document — no direct workspace column), `brag_links`,
`tags` (unique per user per workspace), the `brag_tags` join, `attachments` (file metadata +
storage key, scoped through their brag), and `share_links` (revocable public links to a document —
unique token, optional password hash). Still to come: `instance_admins` (Phase 10) — see
[PLAN.md §5](../PLAN.md) for the full target model. Every workspace-scoped query filters by the
caller's membership through the DAL.

## Documents

A document is a review period — a year, a half, a promotion case. `features/document` owns the
domain: a Zod schema shared by the form and the action, DAL-guarded queries (`listDocuments` /
`listArchivedDocuments` / `getDocument`), and server actions (`createDocument` / `updateDocument` /
`archiveDocument` / `unarchiveDocument` / `deleteDocument`).

Documents are **private per user** — an admin role doesn't widen access — so the actions gate on
`requireWorkspace` (membership), not a role, and every read and write is scoped by `workspace_id`
**and** `user_id`. Mutations enforce ownership _in the query_: the `WHERE` matches the caller's
workspace + user, so a mismatched id touches no row and reports not-found rather than acting across
tenants or users. The authenticated home is `/dashboard`, which lists the caller's active documents
(create/edit in a dialog, reversible archive, and delete — which cascades the document's brags);
archived documents collapse into a restorable "Archived" disclosure. Each document has its own
page at `documents/[documentId]` (see [Brags](#brags)).

## Brags

A brag is one logged win inside a document. `features/brag` owns it: the category taxonomy + Zod
schema, queries (`listBrags`, scoped through the parent document via a join), and actions
(`quickAddBrag` / `createBrag` / `updateBrag` / `deleteBrag`). Brags carry no direct workspace
column, so ownership runs through the parent document — creates resolve the owned document first;
updates and deletes use a correlated `EXISTS` on it in the `WHERE`, so a brag in another workspace
or owned by another user matches no row.

Capture is the priority. The document page has a quick-add bar that logs a brag from a title alone
(the client stamps today's date), with `n` to focus it from anywhere; "Add with details" opens the
full editor (date, category, status, impact, collaborators, attribution, multiple labeled links,
and Markdown description/impact). Markdown renders through a shared, safe-by-default component
(react-markdown + remark-gfm — no raw HTML, dangerous URLs stripped): server-side in the brag cards
(zero client JS) and lazy-loaded for the editor's live preview. Links live in `brag_links`, loaded
with their brags in one batched query (no N+1) and replaced transactionally on edit; they render as
external-link chips (new tab, `rel="noopener noreferrer"`), visually distinct from attachment chips
(paperclip). Attachments (images/PDFs/docs) upload to a saved brag from the editor and load with
their brags (see [Storage & file routes](#storage--file-routes)). The document page renders the
brags as a **month-grouped timeline** (`features/timeline`): sticky month headers with per-month
counts, a vertical spine, and a status-only node on each entry (solid = shipped, hollow =
in-progress); private is a card treatment, not a node ring. Tags are scoped per (user, workspace),
create-or-found on save and reused across brags, shown as monochrome `#name` chips. Full-text
search runs over a generated `search` tsvector on brags (weighted title/impact/description) with a
GIN index: `searchBrags` (`websearch_to_tsquery`, ranked by `ts_rank`, scoped per workspace + user)
backs a header search box → `/search`, whose results deep-link to `/documents/[id]#brag`. The
timeline filters by category / tag / date range (a URL-driven `FilterBar`; `listBrags` applies them,
tag via a correlated `EXISTS`) and marks quiet months between entries. Clicking a brag's title opens
a read-only detail dialog (`BragDetail`) — full Markdown, attachments with inline image previews +
sizes, links, collaborators, and tags. Cursor pagination is the rest of Phase 5; the per-brag
visibility toggle is Phase 6.

## Workspace administration & branding

- **Admin area** (`/admin`, owner/admin via the role policy): workspace settings — name, accent,
  logo. For organizations it also has **members management** (`/admin/members`): invite one or more
  people, resend/revoke pending invitations, change roles, remove members, and **transfer
  ownership** (owner-only, an atomic role swap that keeps exactly one owner). Personal workspaces
  have no member surface. Removing a member emails them a portability bundle of all their data
  (`features/workspace/offboard` — JSON + Markdown + attachments up to a cap), best-effort so a mail
  failure never blocks the removal.
- **Branding is per-workspace.** A validated hex accent + a logo are applied to the app chrome and
  the sign-in page through a `--primary` / `--ring` CSS-variable override on the layout wrapper, and
  to every email template via `lib/branding` — invitations use the inviting org's brand;
  transactional emails (verify / reset / change-email) use the instance brand. The public share
  page (Phase 6) applies the document's workspace brand the same way and footers "Powered by
  BragBit".

## Storage & file routes

One storage interface — `put` / `get` / `delete` / `stat` / `stream` (with an optional inclusive
byte range, for ranged downloads) — selected by `STORAGE_DRIVER`. `LocalDiskStorage` (the default)
writes objects under `STORAGE_DIR` and rejects any key that escapes the root; `S3Storage`
(`@aws-sdk/client-s3`) targets any S3-compatible endpoint — MinIO/R2/S3 — with path-style
addressing on by default for MinIO. Keys are workspace-prefixed (`{workspaceId}/{kind}/…`) for
isolation and quota accounting.

Files upload through role-checked Route Handlers (`/api/upload/avatar`, `/api/upload/logo`) and are
served by an authorizing one (`/api/files/[...key]`):

- `branding/` (logos) — **public**, the deliberate exception (rendered on the pre-auth sign-in page,
  and later on share pages).
- `avatars/` — **session-gated** to a member of the key's workspace.
- `attachments/` — the **owner** (resolved via attachment → brag → document; workspace
  membership isn't enough, since attachments are private per user) **or a valid `?token=` share**
  (the brag must be `shared` and belong to the token's non-revoked document). Served with the
  stored MIME type, an inline `Content-Disposition`, and `Range` → `206` support for large files;
  uploaded through `/api/upload/attachment` (multi-file, MIME-allowlisted, `MAX_UPLOAD_MB`).

Deletion purges the stored objects, not just the rows. Deleting a document removes its attachment
objects; the `deleteUser` hook (`cleanupUserStorage` in `src/features/account/deletion.ts`)
best-effort deletes the user's avatar plus every attachment the row cascade would orphan — the
user's own documents across all workspaces, and all documents in a sole-member workspace being
dropped — before the cascade runs.

## Sharing

A document is shared through a **revocable secret link** (`share_links`, FK-cascaded to the
document): a 24-byte (`base64url`) token that is the only credential — anyone with the URL can view,
no login. The `share` feature module mirrors the rest: DAL-guarded queries (`getActiveShareLink`)
and `"use server"` actions, all resolving document ownership (workspace + user) before any read or
write, so a `documentId` from another workspace or user yields nothing.

- **Owner side** (the `ShareDialog` on the document page): `createShareLink` mints a link
  (idempotent — returns the existing active one, keeping the invariant of **one active link per
  document**), `revokeShareLink` sets `revoked_at` (which 404s the public route), and
  `rotateShareLink` revokes + re-creates in a transaction so the old URL dies the instant the new
  one is shown. The dialog offers copy, rotate, stop-sharing, and surfaces `last_accessed_at`.
- **Public side** (`/share/[token]`, outside the `(app)`/`(auth)` groups, no session):
  `getSharedDocument(token)` resolves the non-revoked token to its document + workspace brand and
  the document's `visibility = 'shared'` brags only (relations batch-loaded, no N+1), then bumps
  `last_accessed_at`. The page applies the document's workspace brand (`accentVars` + logo + name),
  renders a read-only month-grouped timeline, is `noindex`, and footers "Powered by BragBit"; an
  unknown/revoked token renders a friendly 404. The timeline is **card-agnostic** (a `renderCard`
  prop): the owner injects the interactive `BragCard`, the share page injects a read-only
  `PublicBragCard` — both reuse the server-only `BragCardShell`, so the owner editor never reaches
  the public bundle. Attachments stream through the file route's `?token=` path
  (`getSharedAttachmentByKey`: the brag must be `shared` and belong to the token's non-revoked
  document).
- **Optional password** (6.4): the owner sets/changes/removes a password on the active link from
  the dialog — argon2id (`@node-rs/argon2`) in `share_links.password_hash`, never clear. A
  protected share resolves to `getSharedView`'s `locked` state (brand only — no title or brags
  leak) and renders a **progressive-enhancement unlock form**: a plain `<form>` posting to a bound
  server action, so it needs no client JS. A correct password sets an httpOnly per-share cookie
  whose value is an HMAC over `shareId + passwordHash` (keyed by the app secret) — stateless, and
  auto-invalidated when the password changes or is removed. Unlock attempts are rate-limited per
  share (`lib/rate-limit`, an in-memory sliding window; a shared store is Phase 9 hardening), and
  the file route's `?token=` path also requires the unlock cookie when a password is set, so
  attachments never bypass the gate.
- **Invariants & tests** (6.5): at most one _active_ link per document is enforced by a partial
  unique index (`share_links(document_id) WHERE revoked_at IS NULL`, migration `0006`), so a
  create/create race can't produce two — `createShareLink` catches the loser's rejection and
  returns the winner's link. A DB-gated suite (`features/share/security.test.ts`) asserts the
  boundaries against real Postgres: revoked/unknown tokens resolve to nothing, private brags never
  reach a share payload or its attachments, and the password gate locks/unlocks/rate-limits.

## Export

`features/export` turns a document into a portable file (PLAN §6/§7). `documentToMarkdown` is a
**pure** assembler (unit-tested, no DAL): title/period/description/goals, then brags grouped by
month newest-first — date · category · status, impact as a blockquote, the user's Markdown
description verbatim (high-trust assembly), Markdown links, a text attachment manifest (filenames +
sizes; the binaries aren't bundled), collaborators/attribution/tags. `getDocumentForExport` loads
the document + its brags with relations batched (no N+1); it's scoped **explicitly** by
`workspaceId + userId` (passed in by the route, like `getOwnedAttachmentByKey`) rather than calling
a redirecting guard, since export is route-driven. Downloads stream from a Route Handler
(`GET /api/export/[documentId]`): owner-only via `getWorkspaceOrNull` (→ 401), an unowned/missing id
404s, `?format=md` (JSON is a later Phase 7 slice), and `?private=1` opts private brags in (default
off — the same `visibility='shared'` filter the public share uses). The response is an attachment,
never cached. An Export dialog on the document page triggers it.

**PDF is the browser's Save-as-PDF** from a print-optimized view (`/print/[documentId]`, a
standalone route outside the `(app)` chrome, gated by `requireWorkspace`): workspace-branded, the
document's brags grouped by month with each month on a fresh printed page (`break-before: page`).
The v1 decision is browser print over a headless-Chromium service — zero extra infra on every
self-host; since the print view is exactly the render target Chromium would use, adding server-side
rendering later is additive. `?private=1` includes private brags, each marked "Private".

**Full-data JSON** (`GET /api/export/data`, owner-only) downloads the caller's entire dataset in the
active workspace — every document (archived included) and brag (private included; it's the owner's
own copy) with links, attachment metadata, and tags. `getAllDataForExport` batches relations across
all brags at once (no N+1, via the shared `attachRelations`); the pure `toDataExport` shaper maps it
to a **versioned** contract that explicitly omits internal columns (the FTS vector, the
workspace/user FKs). A "Download JSON" link in Settings triggers it. These same exporters power the
member-removal bundle (`features/workspace/offboard`), which emails a removed member their full JSON
and Markdown exports plus the attachment files (read from storage, up to a size cap).

## Reminders

Opt-in weekly reminders (PLAN §6/§8) live in `features/reminder`. A Settings section persists the
preference (enable + day-of-week + IANA timezone) to the `profiles.reminder_*` columns via
`updateReminderSettings`. The scheduling math is a **pure** module (`schedule.ts`, unit-tested):
`localDayHour` resolves a user's local day/hour in their zone, and `isReminderDue` decides whether
it's their chosen day at the target hour (`REMINDER_HOUR`, default 9am local) and they weren't
reminded inside the dedup window (`REMINDER_DEDUP_HOURS`, default 20). `sendDueReminders` loads opted-in users (with their workspace brand, earliest membership),
sends the branded `WeeklyReminder` email to those due — marking `last_reminded_at` **before** the
send so a transient SMTP failure costs a missed nudge, never a duplicate — and returns the count.

Delivery is triggered two ways, both calling `sendDueReminders`: the in-process **`node-cron`
scheduler** in `src/instrumentation.ts` (an hourly tick, gated to the Node.js runtime in production
— the standalone server — so a self-host needs no external cron), and a **secured external-cron
route** (`POST /api/cron/reminders`, `CRON_SECRET` via `Authorization: Bearer`, constant-time
compared; 503 when unconfigured) as the serverless fallback. Running both is safe — the
`last_reminded_at` dedup prevents a double send. Every email carries a **one-click unsubscribe** — a
`/unsubscribe/[userId]/[token]` link whose token is a stateless HMAC over the user id (no token
storage); the page is a no-JS confirm (GET only renders, so a mail-client prefetch can't
unsubscribe; a POST disables reminders) authorized by the token, no login.

## Deployment

The app builds to a self-contained server via Next.js `output: 'standalone'` (a minimal `server.js`
plus only the traced files and `node_modules`), shipped as a multi-stage Docker image:

- **`deps`** installs the full dependency set fresh inside the image — so native modules like
  `@node-rs/argon2` get their musl build — with `--ignore-scripts` to skip the dev-only `prepare`
  hook (lefthook) and dependency postinstalls.
- **`builder`** runs `next build` with placeholder `DATABASE_URL` / `BETTER_AUTH_SECRET` (inlined on
  the build step, not baked into image ENV): `lib/env.ts` validates them, but **no route opens a DB
  connection during the build**. The setup-state and instance-branding reads (`isInstanceSetup` /
  `getInstanceBranding`) call `connection()` to defer out of prerendering — so the root page,
  `/setup`, and the auth pages render dynamically and the placeholders are never used to connect.
  (Next 16 dropped the route-segment `dynamic` export; `connection()` is its supported replacement.)
  Real values arrive at runtime.
- **`runner`** is a slim, non-root (`nextjs:nodejs`) image carrying only the standalone server, the
  static assets, `public/`, and the DB migrator.

**Migrations run on container start.** The entrypoint (`scripts/docker-entrypoint.sh`) runs
`scripts/migrate.mjs` — the `drizzle-orm` migrator, not the drizzle-kit CLI, so the image needs no
dev tooling — then `exec node server.js` so SIGTERM reaches Node for a graceful drain. Because the
migrator is a plain script outside the app graph, `next.config.ts`'s `outputFileTracingIncludes`
force-bundles `drizzle-orm` and `postgres` into the standalone output (Next otherwise inlines
`postgres` into the server chunks, leaving it unresolvable for the script); the `.sql` files are
copied to `/app/migrations`. Local/dev migrations still go through `pnpm db:migrate` (drizzle-kit).

**`docker-compose.yml`** is the one-command stack: `app` + `postgres` (a named volume each; a health
check gates the app on a ready database), with `minio` + `minio-init` behind a `--profile minio` for
S3-compatible storage. Compose injects `DATABASE_URL` (→ the `postgres` service) and `STORAGE_DIR`
(→ the `bragbit_uploads` volume) over `.env`, so the operator only fills in the secrets and SMTP.
The in-process reminder scheduler (`src/instrumentation.ts`) runs in this standalone server, so a
self-host needs no external cron. An unauthenticated `GET /api/health` runs `select 1` and returns
200 `{status:"ok"}` (app + Postgres reachable) or 503 — the Compose `app` healthcheck probes it, and
it carries no instance data. See [Self-hosting](self-hosting/) and [Configuration](configuration.md).

## Security headers & rate limiting

Every response carries an app-wide hardening baseline set in `next.config.ts` `headers()`:
`X-Content-Type-Options: nosniff` (matters for the user files streamed through `/api/files`),
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` (so a share token in the
path never leaks cross-origin via Referer), a `Permissions-Policy` dropping unused device APIs, and
HSTS (honored once seen over TLS). The `Content-Security-Policy` is emitted per-request by
`src/proxy.ts` (Next 16's renamed Middleware) so it can carry a fresh `script-src` nonce each render:
`script-src 'self' 'nonce-…' 'strict-dynamic'` (plus `'unsafe-eval'` only in dev) blocks inline and
injected scripts, alongside the `base-uri 'self'; frame-ancestors 'none'; object-src 'none'` baseline
(clickjacking / base-tag / plugin vectors). The root layout opts the tree into dynamic rendering so
the nonce applies app-wide; Next attaches it to its own scripts automatically.

Rate limiting guards the credential surfaces:

- **Auth** — Better Auth's built-in limiter (`lib/auth`), on in production and off in dev by default
  but overridable either way via `RATE_LIMIT_ENABLED`, keeps its strict default rules for the
  sensitive paths (3 requests / 10s on `/sign-in`, `/sign-up`, `/change-password`, `/change-email`;
  3 / 60s on password-reset + verification email), backed by an in-memory store.
- **Invitation** — `registerInvitee` adds the in-house sliding-window limiter (`lib/rate-limit`, 8
  attempts / 10 min per invitation), since an invalid invitation id is rejected before any Better
  Auth endpoint is reached.
- **Share unlock** — already per-share rate-limited (Phase 6).

All three share the single-process in-memory limiter, consistent with the single-container v1
deployment; a shared store (Better Auth's `secondaryStorage` / a Redis-backed `lib/rate-limit`) is
the multi-instance upgrade for hosted mode. Per-client limiting keys on the client IP, which Better
Auth reads from `X-Forwarded-For` by default — accurate behind the reference reverse proxy;
`TRUSTED_PROXY_IP_HEADER` overrides the header for a proxy that uses a different one.

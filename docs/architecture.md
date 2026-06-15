# Architecture

Kept in sync with [PLAN.md](../PLAN.md) §6. This documents what's **built**; the
full target model and file structure live in PLAN §5–§6.

> **Status:** documented through Phase 3 — layering, authentication & tenancy, the
> DAL boundary, the data model so far, workspace administration & branding, the
> storage adapter, documents, and brags (incl. links). The remaining domain layers
> (attachments, sharing, export) are added here as they land.

## Layering (a security decision)

1. **`app/` is routing only** — thin files that gate access and delegate to a feature.
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
  or invitation acceptance, which set it explicitly.
- **Invitations** are tokenized, 7-day, single-use, and bind registration to the invited email
  (acceptability is the pure, unit-tested `isAcceptableInvitation`); see the
  [Admin guide](admin-guide.md).
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
`tags` (unique per user per workspace), the `brag_tags` join, and `attachments` (file metadata +
storage key, scoped through their brag). Still to come: `share_links` (Phase 6) and
`instance_admins` (Phase 10) — see
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
backs a header search box → `/search`, whose results deep-link to `/documents/[id]#brag`. Filters
and cursor pagination are the rest of Phase 5; the per-brag visibility toggle is Phase 6.

## Workspace administration & branding

- **Admin area** (`/admin`, owner/admin via the role policy): workspace settings — name, accent,
  logo. For organizations it also has **members management** (`/admin/members`): invite one or more
  people, resend/revoke pending invitations, change roles, remove members, and **transfer
  ownership** (owner-only, an atomic role swap that keeps exactly one owner). Personal workspaces
  have no member surface.
- **Branding is per-workspace.** A validated hex accent + a logo are applied to the app chrome and
  the sign-in page through a `--primary` / `--ring` CSS-variable override on the layout wrapper, and
  to every email template via `lib/branding` — invitations use the inviting org's brand;
  transactional emails (verify / reset / change-email) use the instance brand. Share-page branding
  and the "Powered by BragBit" footer land in Phase 6.

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
- `attachments/` — the **owner only** (resolved via attachment → brag → document; workspace
  membership isn't enough, since attachments are private per user). Served with the stored MIME
  type, an inline `Content-Disposition`, and `Range` → `206` support for large files; uploaded
  through `/api/upload/attachment` (multi-file, MIME-allowlisted, `MAX_UPLOAD_MB`). The
  valid-share-token path lands in Phase 6.

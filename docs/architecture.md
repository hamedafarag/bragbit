# Architecture

Kept in sync with [PLAN.md](../PLAN.md) §6.

> **Status:** the foundation — layering, authentication/tenancy, the DAL boundary,
> and the storage adapter — is documented below. The domain layers (documents,
> brags, sharing, export) are added here as they land.

## Layering (a security decision)

1. **`app/` is routing only** — thin files that gate access and delegate to a feature.
2. **Code lives in feature modules** (`features/brag`, `features/document`, …), grouped by domain.
3. **One hard boundary — the Data Access Layer (DAL).** Every DB read/write passes through
   guards (`requireSession` / `requireWorkspace` / `requireRole`) that verify session **and**
   workspace membership. Nothing outside the DAL imports the Drizzle client.

Import direction is one-way: `app/` → `features/` → `lib/auth/guards` → `lib/db` · `lib/storage` · `lib/email`.

Authorization lives in the DAL and server components/layouts, never in middleware (which does
optimistic cookie/mode redirects only). The guards come in two flavors: `requireSession` /
`requireWorkspace` / `requireRole` (redirecting — for Server Components and Server Actions) and
`getSessionOrNull` / `getWorkspaceOrNull` / `isWorkspaceMember` (non-redirecting — for Route
Handlers, which answer with an HTTP status). Both keep every membership lookup inside the DAL.

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
- **Credentials.** Password hashes live in Better Auth's `account` table, never on `user`; the
  Drizzle client is `import 'server-only'` so DB code never reaches a client bundle.

## Storage adapter

One interface — `put` / `get` / `delete` / `stream` — selected by `STORAGE_DRIVER`. `LocalDiskStorage`
(the default) writes objects under `STORAGE_DIR` and rejects any key that escapes the root;
`S3Storage` lands in Phase 4. Keys are prefixed per workspace (`{workspaceId}/…`) for isolation and
quota accounting. Files are never public URLs: uploads go through a Route Handler, and downloads
stream through an authorizing one (`/api/files/[...key]`) that checks workspace membership — in
Phase 1 it serves avatars only; attachment and share-token rules arrive in Phases 4 and 6.

# Architecture

Kept in sync with [PLAN.md](../PLAN.md) §6.

> **Status:** stub — expanded as the layers land.

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

## Storage adapter

One interface — `put` / `get` / `delete` / `stream` — selected by `STORAGE_DRIVER`. `LocalDiskStorage`
(the default) writes objects under `STORAGE_DIR` and rejects any key that escapes the root;
`S3Storage` lands in Phase 4. Keys are prefixed per workspace (`{workspaceId}/…`) for isolation and
quota accounting. Files are never public URLs: uploads go through a Route Handler, and downloads
stream through an authorizing one (`/api/files/[...key]`) that checks workspace membership — in
Phase 1 it serves avatars only; attachment and share-token rules arrive in Phases 4 and 6.

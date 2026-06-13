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
optimistic cookie/mode redirects only).

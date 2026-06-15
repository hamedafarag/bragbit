// Apply pending Drizzle migrations against DATABASE_URL, then exit. The Docker
// entrypoint runs this before the server starts, so a fresh container provisions
// its own schema (PLAN §6 — "migrations run on container start").
//
// It uses the drizzle-orm migrator (a runtime dependency) rather than the
// drizzle-kit CLI, so the slim production image needs no dev tooling. The migrator
// package is force-bundled into the standalone output via `outputFileTracingIncludes`
// in next.config.ts; the .sql files are copied to /app/migrations by the Dockerfile.
//
// Local/dev migrations still go through `pnpm db:migrate` (drizzle-kit). To run
// this script outside the container, point it at the source migrations folder:
//   MIGRATIONS_DIR=src/lib/db/migrations node scripts/migrate.mjs
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[migrate] DATABASE_URL is not set");
  process.exit(1);
}

// Default to ../migrations (where the Dockerfile copies the .sql files), overridable
// for running against the source tree in dev.
const migrationsFolder =
  process.env.MIGRATIONS_DIR ?? fileURLToPath(new URL("../migrations", import.meta.url));

const sql = postgres(databaseUrl, { max: 1 });
try {
  await migrate(drizzle(sql), { migrationsFolder });
  console.log("[migrate] database is up to date");
} catch (err) {
  console.error("[migrate] migration failed:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}

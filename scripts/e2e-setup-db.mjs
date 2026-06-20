// Provision the isolated database the setup-wizard e2e drives: create it if
// missing, then apply migrations. Run as a plain Node script (not via Playwright's
// loader) so the drizzle migrator imports cleanly, like scripts/migrate.mjs. The
// spec truncates this DB before each attempt to restore the pre-setup state.
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url =
  process.env.SETUP_DATABASE_URL ?? "postgres://bragbit:bragbit@localhost:5433/bragbit_e2e_setup";
const dbName = new URL(url).pathname.slice(1);
const adminUrl = new URL(url);
adminUrl.pathname = "/postgres";

const admin = postgres(adminUrl.toString(), { max: 1 });
try {
  const exists = await admin`select 1 from pg_database where datname = ${dbName}`;
  if (exists.length === 0) await admin.unsafe(`create database "${dbName}"`);
} finally {
  await admin.end();
}

const sql = postgres(url, { max: 1 });
try {
  await migrate(drizzle(sql), {
    migrationsFolder: fileURLToPath(new URL("../src/lib/db/migrations", import.meta.url)),
  });
  console.log(`[e2e-setup-db] ${dbName} ready`);
} finally {
  await sql.end();
}

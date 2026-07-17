// Provision + reset the isolated database the hosted-mode e2e drives. Runs once
// before the suite (Playwright globalSetup): create the DB if missing, apply
// migrations, then truncate so open-signup runs (which create real users) start
// from a clean slate on every invocation. Mirrors scripts/e2e-setup-db.mjs, but
// self-contained in the config so `test:e2e:hosted` is a single command.
import path from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export const HOSTED_DB_URL =
  process.env.HOSTED_DATABASE_URL ?? "postgres://bragbit:bragbit@localhost:5433/bragbit_e2e_hosted";

export default async function globalSetup() {
  const dbName = new URL(HOSTED_DB_URL).pathname.slice(1);
  const adminUrl = new URL(HOSTED_DB_URL);
  adminUrl.pathname = "/postgres";

  const admin = postgres(adminUrl.toString(), { max: 1 });
  try {
    const exists = await admin`select 1 from pg_database where datname = ${dbName}`;
    if (exists.length === 0) await admin.unsafe(`create database "${dbName}"`);
  } finally {
    await admin.end();
  }

  const sql = postgres(HOSTED_DB_URL, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), {
      migrationsFolder: path.join(process.cwd(), "src/lib/db/migrations"),
    });
    // Clean slate — truncating user + organization cascades to sessions, accounts,
    // members, profiles, documents → brags, so each run starts empty.
    await sql`truncate "user", organization cascade`;
  } finally {
    await sql.end();
  }
  console.log(`[e2e-hosted] ${dbName} ready`);
}

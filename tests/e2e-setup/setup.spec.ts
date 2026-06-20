import postgres from "postgres";

import { expect, test } from "@playwright/test";

// The isolated DB is provisioned + migrated by scripts/e2e-setup-db.mjs (run by
// the `test:e2e:setup` script before Playwright); this spec only resets it.
const SETUP_DATABASE_URL =
  process.env.SETUP_DATABASE_URL ?? "postgres://bragbit:bragbit@localhost:5433/bragbit_e2e_setup";

// E2E for the first-run setup wizard (ENH-TEST-02), run against an isolated empty
// instance so `/setup` is reachable. The whole config is invoked twice — once per
// private mode (see the `test:e2e:setup` script) — and reads INSTANCE_MODE to set
// the mode-specific expectations. The wizard's success redirect is a client-side
// router.push, so the workspace-created outcome is polled from the DB.
const mode = process.env.INSTANCE_MODE ?? "private-solo";
const isSolo = mode === "private-solo";
const sql = postgres(SETUP_DATABASE_URL);

async function truncateAll() {
  const tables = await sql<{ tablename: string }[]>`
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> '__drizzle_migrations'`;
  const list = tables.map((t) => `"${t.tablename}"`).join(", ");
  if (list) await sql.unsafe(`truncate ${list} restart identity cascade`);
}

// Empty state before each attempt (the wizard creates a workspace, and retries
// must start fresh — `/setup` closes permanently once a workspace exists).
test.beforeEach(truncateAll);
test.afterAll(async () => {
  await sql.end();
});

test(`first-run wizard creates the ${isSolo ? "personal" : "organization"} workspace (${mode})`, async ({
  page,
}) => {
  await page.goto("/setup");
  // The wizard is reachable only on an un-set-up instance; the form rendering
  // (not a redirect to "/") confirms it.
  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.locator("#name")).toBeVisible();

  await page.fill("#name", "Setup Owner");
  await page.fill("#email", "setup-owner@e2e.test");
  await page.fill("#password", "SetupPass123");
  await page.fill("#workspaceName", isSolo ? "My Logbook" : "Acme Inc");
  await page
    .getByRole("button", { name: isSolo ? "Create workspace" : "Create organization" })
    .click();

  // Outcome (robust to the soft redirect): the workspace exists with the mode's type.
  await expect
    .poll(
      async () => {
        const [o] = await sql<{ type: string }[]>`select type from organization limit 1`;
        return o?.type ?? null;
      },
      { timeout: 20_000 },
    )
    .toBe(isSolo ? "personal" : "organization");

  // The owner is signed in (completeSetup sets the session cookie). The member
  // surface exists only for an organization; a personal workspace has none.
  await page.goto("/admin/members");
  if (isSolo) {
    await expect(page).toHaveURL(/\/admin$/);
  } else {
    await expect(page.getByRole("heading", { name: "Members", exact: true })).toBeVisible();
  }
});

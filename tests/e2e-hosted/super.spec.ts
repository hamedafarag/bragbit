import { hashPassword } from "better-auth/crypto";
import postgres from "postgres";

import { expect, test, type Page } from "@playwright/test";

// Hosted-mode e2e (PLAN §10 — instance superadmin). The superadmin (email in the
// config's SUPERADMIN_EMAILS) reaches /super and suspends a workspace; a regular
// signed-in user gets a 404 there (the console never advertises itself). Seeds a
// superadmin, a regular user, and a target org; asserts the suspend via DB poll.
const HOSTED_DB_URL =
  process.env.HOSTED_DATABASE_URL ?? "postgres://bragbit:bragbit@localhost:5433/bragbit_e2e_hosted";
const sql = postgres(HOSTED_DB_URL, { onnotice: () => {} });

const SUPER = {
  id: "e2e-super",
  name: "Super Admin",
  email: "superadmin-e2e@bragbit.local",
  password: "superpass123",
  personal: "e2e-super-personal",
};
const REG = {
  id: "e2e-super-reg",
  name: "Reg User",
  email: "reg-e2e@bragbit.local",
  password: "regpass123",
  personal: "e2e-super-reg-personal",
};
const TARGET = { id: "e2e-super-target", name: "Target Org" };

async function cleanup() {
  await sql`delete from "user" where id in (${SUPER.id}, ${REG.id})`;
  await sql`delete from organization where id in (${SUPER.personal}, ${REG.personal}, ${TARGET.id})`;
}

async function seedUser(u: typeof SUPER) {
  const pw = await hashPassword(u.password);
  await sql`insert into "user" (id, name, email, email_verified) values (${u.id}, ${u.name}, ${u.email}, true)`;
  await sql`insert into account (id, account_id, provider_id, user_id, password)
            values (${`${u.id}-acct`}, ${u.id}, 'credential', ${u.id}, ${pw})`;
  await sql`insert into organization (id, name, slug, type)
            values (${u.personal}, ${`${u.name}'s Logbook`}, ${u.personal}, 'personal')`;
  await sql`insert into member (id, organization_id, user_id, role)
            values (${`${u.personal}-mem`}, ${u.personal}, ${u.id}, 'owner')`;
}

test.beforeAll(async () => {
  await cleanup();
  await seedUser(SUPER);
  await seedUser(REG);
  // A target org (owned by the regular user) for the superadmin to suspend.
  await sql`insert into organization (id, name, slug, type)
            values (${TARGET.id}, ${TARGET.name}, ${TARGET.id}, 'organization')`;
  await sql`insert into member (id, organization_id, user_id, role)
            values (${`${TARGET.id}-mem`}, ${TARGET.id}, ${REG.id}, 'owner')`;
});

test.afterAll(async () => {
  await cleanup();
  await sql.end();
});

async function signIn(page: Page, u: typeof SUPER) {
  await page.goto("/sign-in");
  await page.fill("#email", u.email);
  await page.fill("#password", u.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => new URL(url).pathname === "/dashboard", { timeout: 20_000 });
}

test("a superadmin suspends a workspace from the /super console", async ({ page }) => {
  await signIn(page, SUPER);
  await page.goto("/super");
  await expect(page.getByRole("heading", { name: "Instance admin" })).toBeVisible();

  // Suspend the target workspace from its row (the row also has a quota "Save" button).
  await page
    .locator("tr", { hasText: TARGET.name })
    .getByRole("button", { name: "Suspend" })
    .click();

  await expect
    .poll(
      async () => {
        const [row] = await sql`select suspended_at from organization where id = ${TARGET.id}`;
        return row?.suspended_at != null;
      },
      { timeout: 20_000 },
    )
    .toBe(true);
});

test("a non-superadmin gets a 404 at /super", async ({ page }) => {
  await signIn(page, REG);
  const resp = await page.goto("/super");
  expect(resp?.status()).toBe(404);
});

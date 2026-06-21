import { hashPassword } from "better-auth/crypto";
import postgres from "postgres";

import { expect, test } from "@playwright/test";

// Hosted-mode e2e (PLAN §10 — workspace switcher). A user who belongs to two
// workspaces (their personal one + an org) switches the active one through the
// header switcher. We seed the user + both memberships, sign in (lands in the
// earliest = personal), switch to the org, and assert the session's active org
// flipped (DB poll — robust to client-nav timing).
const HOSTED_DB_URL =
  process.env.HOSTED_DATABASE_URL ?? "postgres://bragbit:bragbit@localhost:5433/bragbit_e2e_hosted";
const sql = postgres(HOSTED_DB_URL, { onnotice: () => {} });

const USER = {
  id: "e2e-switcher",
  name: "Switcher",
  email: "switcher-e2e@bragbit.local",
  password: "switcherpass123",
};
const PERSONAL = "e2e-switcher-personal";
const ORG = "e2e-switcher-org";

async function cleanup() {
  await sql`delete from "user" where id = ${USER.id}`;
  await sql`delete from organization where id in (${PERSONAL}, ${ORG})`;
}

test.beforeAll(async () => {
  await cleanup();
  const password = await hashPassword(USER.password);
  await sql`insert into "user" (id, name, email, email_verified)
            values (${USER.id}, ${USER.name}, ${USER.email}, true)`;
  await sql`insert into account (id, account_id, provider_id, user_id, password)
            values ('e2e-switcher-acct', ${USER.id}, 'credential', ${USER.id}, ${password})`;
  // Personal membership first (earliest → active on sign-in), then an org they own.
  await sql`insert into organization (id, name, slug, type)
            values (${PERSONAL}, ${"Switcher's Logbook"}, 'e2e-switcher-personal', 'personal')`;
  await sql`insert into member (id, organization_id, user_id, role)
            values ('e2e-switcher-m1', ${PERSONAL}, ${USER.id}, 'owner')`;
  await sql`insert into organization (id, name, slug, type)
            values (${ORG}, 'Switcher Org', 'e2e-switcher-org', 'organization')`;
  await sql`insert into member (id, organization_id, user_id, role)
            values ('e2e-switcher-m2', ${ORG}, ${USER.id}, 'owner')`;
});

test.afterAll(async () => {
  await cleanup();
  await sql.end();
});

test("a user switches their active workspace via the header switcher", async ({ page }) => {
  await page.goto("/sign-in");
  await page.fill("#email", USER.email);
  await page.fill("#password", USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => new URL(url).pathname === "/dashboard", { timeout: 20_000 });

  // Open the switcher (its trigger is labelled "Switch workspace") and pick the org.
  await page.getByRole("button", { name: "Switch workspace" }).click();
  await page.getByRole("button", { name: /Switcher Org/ }).click();

  // The session's active organization is now the org.
  await expect
    .poll(
      async () => {
        const [row] = await sql`
          select active_organization_id from session
          where user_id = ${USER.id} order by updated_at desc limit 1`;
        return row?.active_organization_id ?? null;
      },
      { timeout: 20_000 },
    )
    .toBe(ORG);
});

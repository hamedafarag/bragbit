import { hashPassword } from "better-auth/crypto";
import postgres from "postgres";

import { expect, test } from "@playwright/test";

// Hosted-mode e2e (PLAN §10 — user-created organizations). A signed-in user creates
// an organization through the UI, becomes its owner, and is switched into it. We
// seed a verified, password-backed user (+ their personal workspace) so we can sign
// in, then assert the new org membership in the DB (robust to client-nav timing).
const HOSTED_DB_URL =
  process.env.HOSTED_DATABASE_URL ?? "postgres://bragbit:bragbit@localhost:5433/bragbit_e2e_hosted";
const sql = postgres(HOSTED_DB_URL, { onnotice: () => {} });

const USER = {
  id: "e2e-orgmaker",
  name: "Org Maker",
  email: "orgmaker-e2e@bragbit.local",
  password: "orgmakerpass123",
  personalOrg: "e2e-orgmaker-personal",
};
const ORG_NAME = "Acme Corp";

async function cleanup() {
  await sql`delete from organization where name = ${ORG_NAME} and type = 'organization'`;
  await sql`delete from "user" where id = ${USER.id}`;
  await sql`delete from organization where id = ${USER.personalOrg}`;
}

test.beforeAll(async () => {
  await cleanup();
  // A clean, verified, signable-in user with a personal workspace.
  const password = await hashPassword(USER.password);
  await sql`insert into "user" (id, name, email, email_verified)
            values (${USER.id}, ${USER.name}, ${USER.email}, true)`;
  await sql`insert into account (id, account_id, provider_id, user_id, password)
            values ('e2e-orgmaker-acct', ${USER.id}, 'credential', ${USER.id}, ${password})`;
  await sql`insert into organization (id, name, slug, type)
            values (${USER.personalOrg}, ${"Org Maker's Logbook"}, 'e2e-orgmaker-personal', 'personal')`;
  await sql`insert into member (id, organization_id, user_id, role)
            values ('e2e-orgmaker-mem', ${USER.personalOrg}, ${USER.id}, 'owner')`;
});

test.afterAll(async () => {
  await cleanup();
  await sql.end();
});

test("a signed-in user creates an organization and becomes its owner", async ({ page }) => {
  // Sign in (verified + has a personal workspace, so the app is reachable).
  await page.goto("/sign-in");
  await page.fill("#email", USER.email);
  await page.fill("#password", USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => new URL(url).pathname === "/dashboard", { timeout: 20_000 });

  // The hosted header's workspace switcher offers "Create organization".
  await page.getByRole("button", { name: "Switch workspace" }).click();
  await page.getByRole("link", { name: "Create organization" }).click();
  await expect(page.getByRole("heading", { name: "Create an organization" })).toBeVisible();
  await page.fill("#name", ORG_NAME);
  await page.getByRole("button", { name: "Create organization" }).click();

  // The caller is now the OWNER of an `organization` workspace named "Acme Corp".
  await expect
    .poll(
      async () => {
        const [row] = await sql`
          select o.type, m.role from member m
          join organization o on o.id = m.organization_id
          where m.user_id = ${USER.id} and o.name = ${ORG_NAME}`;
        return row ? `${row.type}:${row.role}` : null;
      },
      { timeout: 20_000 },
    )
    .toBe("organization:owner");
});

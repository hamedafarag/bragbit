import { hashPassword } from "better-auth/crypto";
import postgres from "postgres";

import { expect, test, type Page } from "@playwright/test";

// Hosted-mode e2e (PLAN §10 — per-workspace branding on a shared instance). One user
// belongs to two differently-branded orgs plus a personal workspace; switching
// re-themes the app to the active workspace's accent (orgs self-brand; the personal
// workspace uses the instance default). The accent cascades via the `--primary` CSS
// variable that the (app) layout sets from the active workspace.
test.use({ colorScheme: "light" });

const HOSTED_DB_URL =
  process.env.HOSTED_DATABASE_URL ?? "postgres://bragbit:bragbit@localhost:5433/bragbit_e2e_hosted";
const sql = postgres(HOSTED_DB_URL, { onnotice: () => {} });

const USER = {
  id: "e2e-brand",
  name: "Brand User",
  email: "brand-e2e@bragbit.local",
  password: "brandpass123",
};
const PERSONAL = "e2e-brand-personal";
const ORG_X = { id: "e2e-brand-x", name: "Brand X", accent: "#1a7f37" };
const ORG_Y = { id: "e2e-brand-y", name: "Brand Y", accent: "#8250df" };
const DEFAULT_ACCENT = "#e8590c"; // globals.css :root --primary

async function cleanup() {
  await sql`delete from "user" where id = ${USER.id}`;
  await sql`delete from organization where id in (${PERSONAL}, ${ORG_X.id}, ${ORG_Y.id})`;
}

test.beforeAll(async () => {
  await cleanup();
  const pw = await hashPassword(USER.password);
  await sql`insert into "user" (id, name, email, email_verified) values (${USER.id}, ${USER.name}, ${USER.email}, true)`;
  await sql`insert into account (id, account_id, provider_id, user_id, password)
            values ('e2e-brand-acct', ${USER.id}, 'credential', ${USER.id}, ${pw})`;
  // Personal first (active on sign-in), then two branded orgs.
  await sql`insert into organization (id, name, slug, type)
            values (${PERSONAL}, ${"Brand User's Logbook"}, 'e2e-brand-personal', 'personal')`;
  await sql`insert into member (id, organization_id, user_id, role)
            values ('e2e-brand-m0', ${PERSONAL}, ${USER.id}, 'owner')`;
  await sql`insert into organization (id, name, slug, type, accent_color)
            values (${ORG_X.id}, ${ORG_X.name}, 'e2e-brand-x', 'organization', ${ORG_X.accent})`;
  await sql`insert into member (id, organization_id, user_id, role)
            values ('e2e-brand-mx', ${ORG_X.id}, ${USER.id}, 'owner')`;
  await sql`insert into organization (id, name, slug, type, accent_color)
            values (${ORG_Y.id}, ${ORG_Y.name}, 'e2e-brand-y', 'organization', ${ORG_Y.accent})`;
  await sql`insert into member (id, organization_id, user_id, role)
            values ('e2e-brand-my', ${ORG_Y.id}, ${USER.id}, 'owner')`;
});

test.afterAll(async () => {
  await cleanup();
  await sql.end();
});

function primaryVar(page: Page) {
  return page.evaluate(() =>
    getComputedStyle(document.querySelector("main")!).getPropertyValue("--primary").trim(),
  );
}

async function switchTo(page: Page, name: string) {
  await page.getByRole("button", { name: "Switch workspace" }).click();
  await page.getByRole("button", { name: new RegExp(name) }).click();
}

test("each org applies its own brand accent; switching re-themes; personal uses the default", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.fill("#email", USER.email);
  await page.fill("#password", USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => new URL(url).pathname === "/dashboard", { timeout: 20_000 });

  // Active = personal → the instance-default accent (no per-workspace override).
  expect(await primaryVar(page)).toBe(DEFAULT_ACCENT);

  // Switch to Brand X → its accent, and the switcher shows its name.
  await switchTo(page, ORG_X.name);
  await expect.poll(() => primaryVar(page)).toBe(ORG_X.accent);
  await expect(page.getByRole("button", { name: "Switch workspace" })).toContainText(ORG_X.name);

  // Switch to Brand Y → its (different) accent.
  await switchTo(page, ORG_Y.name);
  await expect.poll(() => primaryVar(page)).toBe(ORG_Y.accent);
  await expect(page.getByRole("button", { name: "Switch workspace" })).toContainText(ORG_Y.name);
});

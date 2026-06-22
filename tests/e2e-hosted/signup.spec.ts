import postgres from "postgres";

import { expect, test } from "@playwright/test";

// Hosted-mode e2e (PLAN §10 — open signup). A logged-out visitor signs up through
// the public form; the account is created (Better Auth, required verification → a
// verify email + the /verify-email page) and the user-create hook provisions a
// personal workspace. We assert the deliverable — the new account owns a personal
// workspace — by polling the DB, which is robust to client-side nav timing (like
// the invitation e2e). Needs the dev stack's Postgres + Mailpit (a mailpit service
// in CI), since signup sends a real verification email.
const HOSTED_DB_URL =
  process.env.HOSTED_DATABASE_URL ?? "postgres://bragbit:bragbit@localhost:5433/bragbit_e2e_hosted";
const sql = postgres(HOSTED_DB_URL);

const EMAIL = "signup-e2e@bragbit.local";

test.beforeEach(async () => {
  // Deleting the user cascades its account/session/membership, so each attempt
  // (and retry) starts clean even though signup creates a real account.
  await sql`delete from "user" where email = ${EMAIL}`;
});

test.afterAll(async () => {
  await sql.end();
});

test("open signup creates an account and provisions a personal workspace", async ({ page }) => {
  await page.goto("/sign-up");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();

  await page.fill("#name", "Dana Scully");
  await page.fill("#email", EMAIL);
  await page.fill("#password", "supersecret123");
  await page.getByRole("button", { name: "Create account" }).click();

  // Required verification → no session yet; the form routes to the verify page.
  // Generous timeout: signup also sends a verification email, which is slower under
  // the parallel hosted-suite load.
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible({
    timeout: 15_000,
  });

  // The deliverable: the account now owns a `personal` workspace (provisioned by the
  // user-create hook). Poll the DB rather than the UI — the user isn't signed in yet.
  await expect
    .poll(
      async () => {
        const [row] = await sql`
          select o.type, m.role from member m
          join organization o on o.id = m.organization_id
          join "user" u on u.id = m.user_id
          where u.email = ${EMAIL}`;
        return row ? `${row.type}:${row.role}` : null;
      },
      { timeout: 20_000 },
    )
    .toBe("personal:owner");
});

test("the sign-in page links to open signup in hosted mode", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("link", { name: "Create an account" })).toBeVisible();
});

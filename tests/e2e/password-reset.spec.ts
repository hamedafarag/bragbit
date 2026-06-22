import postgres from "postgres";

import { expect, test, type Page } from "@playwright/test";

import { E2E } from "./global-setup";

// Password reset + resend-verification. CI doesn't expose Mailpit's HTTP API (only
// SMTP), and the local .env SMTP may not reach Mailpit, so rather than read the email
// we pull the reset token straight from Better Auth's `verification` table — which is
// committed before the email is sent, so it's there regardless of SMTP. Uses a
// throwaway personal account, re-seeded fresh each run.
const sql = postgres(process.env.DATABASE_URL ?? "");

test.afterAll(async () => {
  await sql.end();
});

async function signInStatus(page: Page, email: string, password: string): Promise<number> {
  await page.goto("/sign-in");
  await page.fill("#email", email);
  await page.fill("#password", password);
  const resP = page.waitForResponse(
    (r) => r.url().includes("/api/auth/sign-in") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  return (await resP).status();
}

test("forgot → reset via the token → sign in with the new password", async ({ page }) => {
  const { email, userId } = E2E.accounts.reset;
  const newPassword = "ResetE2ePass456!";

  // Clean slate for a deterministic token read (the row is keyed by user id).
  await sql`delete from verification where value = ${userId}`;

  await page.goto("/forgot-password");
  await page.fill("#email", email);
  await page.getByRole("button", { name: "Send reset link" }).click();

  // The token is stored (identifier = "reset-password:<token>") before the email is
  // sent — poll the DB for it, robust to SMTP timing/availability.
  let token = "";
  await expect
    .poll(
      async () => {
        const [r] = await sql`
          select identifier from verification
          where value = ${userId} and expires_at > now()
          order by created_at desc limit 1`;
        if (r) token = String(r.identifier).slice(String(r.identifier).lastIndexOf(":") + 1);
        return token;
      },
      { timeout: 15_000 },
    )
    .not.toBe("");

  // Complete the reset on the real page.
  await page.goto(`/reset-password?token=${token}`);
  await page.getByLabel("New password").fill(newPassword);
  await page.getByRole("button", { name: "Set new password" }).click();
  await page.waitForURL((url) => new URL(url).pathname === "/sign-in", { timeout: 20_000 });

  // The new password works; the old one no longer does.
  expect(await signInStatus(page, email, newPassword)).toBe(200);
  await page.context().clearCookies();
  expect(await signInStatus(page, email, E2E.password)).toBeGreaterThanOrEqual(400);
});

test("the reset page rejects a missing token", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
  await expect(page.getByLabel("New password")).toHaveCount(0);
});

test("resend verification shows a neutral confirmation", async ({ page }) => {
  await page.goto("/verify-email");
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  await page.fill("#email", E2E.accounts.reset.email);
  await page.getByRole("button", { name: "Resend verification email" }).click();
  await expect(page.getByText(/check your inbox/i)).toBeVisible();
});

import { expect, test, type Page } from "@playwright/test";

import { E2E } from "./global-setup";

// Account settings — the security-sensitive flows: changing the password (the new
// credential must work and the old must stop working) and deleting the account
// (the user is really gone afterward). Each uses a throwaway personal-workspace
// account so the shared owner/member fixture is never touched.

async function signIn(page: Page, email: string, password = E2E.password) {
  await page.goto("/sign-in");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => new URL(url).pathname === "/dashboard", { timeout: 20_000 });
}

/** A wrong-or-right sign-in attempt, returning the auth endpoint's HTTP status. */
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

test("change password: the new credential works and the old one is rejected", async ({ page }) => {
  const newPassword = "NewE2ePass9876!";
  const { email } = E2E.accounts.changePw;

  await signIn(page, email);
  await page.goto("/settings");
  await page.getByLabel("Current password").fill(E2E.password);
  await page.getByLabel("New password").fill(newPassword);
  await page.getByRole("button", { name: "Change password" }).click();
  // The form clears its fields on success.
  await expect(page.getByLabel("Current password")).toHaveValue("");

  // The old password no longer signs in …
  await page.context().clearCookies();
  expect(await signInStatus(page, email, E2E.password)).toBeGreaterThanOrEqual(400);
  // … and the new one does.
  await signIn(page, email, newPassword);
});

test("delete account removes the user", async ({ page }) => {
  const { email } = E2E.accounts.del;

  await signIn(page, email);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete account" }).click(); // opens the confirm dialog
  await page.getByLabel("Confirm your password").fill(E2E.password);
  await page.getByRole("dialog").getByRole("button", { name: "Delete account" }).click();

  // Deletion signs out and hard-redirects to sign-in; the account is then gone.
  await page.waitForURL((url) => new URL(url).pathname === "/sign-in", { timeout: 20_000 });
  await page.context().clearCookies();
  expect(await signInStatus(page, email, E2E.password)).toBeGreaterThanOrEqual(400);
});

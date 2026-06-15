import { expect, test, type Page } from "@playwright/test";

import { E2E } from "./global-setup";

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.fill("#email", email);
  await page.fill("#password", E2E.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // The sign-in form redirects to "/dashboard" on success.
  await page.waitForURL((url) => new URL(url).pathname === "/dashboard", { timeout: 20_000 });
}

test("a member is redirected away from the admin area", async ({ page }) => {
  await signIn(page, E2E.memberEmail);
  await page.goto("/admin");
  // The /admin layout gate (canAdminister) redirects a non-admin to "/".
  expect(new URL(page.url()).pathname).toBe("/");
});

test("an owner can reach the admin area", async ({ page }) => {
  await signIn(page, E2E.ownerEmail);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible();
});

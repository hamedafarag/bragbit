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

test("a member is sent straight to the dashboard from /admin", async ({ page }) => {
  await signIn(page, E2E.memberEmail);
  // The /admin gate now redirects a non-admin directly to /dashboard — a single
  // 307 — instead of bouncing through "/" (which re-dispatches). ENH-CQ-06.
  const res = await page.request.get("/admin", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(new URL(res.headers()["location"] ?? "", "http://e2e").pathname).toBe("/dashboard");
  // And a real navigation lands there (no redirect loop).
  await page.goto("/admin");
  await page.waitForURL((url) => new URL(url).pathname === "/dashboard", { timeout: 20_000 });
});

test("an owner can reach the admin area", async ({ page }) => {
  await signIn(page, E2E.ownerEmail);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible();
});

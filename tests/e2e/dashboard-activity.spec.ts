import { expect, test, type Page } from "@playwright/test";

import { E2E } from "./global-setup";

// e2e for the dashboard activity heatmap + streak (ENH-UX-05): after logging a
// win today, the dashboard surfaces the Activity panel with a live (non-zero)
// week streak. Local sign-in helper mirrors core-flow.spec.ts.
async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.fill("#email", email);
  await page.fill("#password", E2E.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => new URL(url).pathname === "/dashboard", { timeout: 20_000 });
}

test("logging a win surfaces the activity heatmap on the dashboard", async ({ page }) => {
  const stamp = Date.now();
  const docTitle = `E2E Activity ${stamp}`;

  await signIn(page, E2E.ownerEmail);

  await test.step("create a document and log a win today", async () => {
    await page.getByRole("button", { name: "New document" }).first().click();
    await page.fill("#doc-title", docTitle);
    await page.getByRole("button", { name: "Create document" }).click();
    await page.getByRole("link", { name: docTitle }).click();
    await page.waitForURL(/\/documents\/.+/);
    await page.getByPlaceholder(/Log a win/).fill(`A win ${stamp}`);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(`A win ${stamp}`)).toBeVisible();
  });

  await test.step("the dashboard shows the activity panel with a live streak", async () => {
    await page.goto("/dashboard");
    await expect(page.getByRole("img", { name: /Win activity/ })).toBeVisible();
    // A win logged today makes the current week active → a non-zero week streak.
    await expect(page.getByText(/[1-9]\d*-week streak/)).toBeVisible();
  });
});

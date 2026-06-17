import { expect, test } from "@playwright/test";

test("the root path redirects an anonymous visitor to sign-in", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL((url) => new URL(url).pathname === "/sign-in", { timeout: 20_000 });
  // The sign-in form rendered (its email field is the stable anchor).
  await expect(page.locator("#email")).toBeVisible();
});

import { expect, test, type Page } from "@playwright/test";

import { E2E } from "./global-setup";

// e2e for the skip-to-content link (ENH-UX-02): the first Tab reveals it and
// Enter moves focus into <main>. Local sign-in helper mirrors core-flow.spec.ts.
async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.fill("#email", email);
  await page.fill("#password", E2E.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => new URL(url).pathname === "/dashboard", { timeout: 20_000 });
}

test("skip-to-content link moves focus to main", async ({ page }) => {
  await signIn(page, E2E.ownerEmail);
  await page.goto("/dashboard");

  // The first Tab from the top of the page reveals the skip link and focuses it.
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();

  // Activating it moves focus to <main id="main-content"> (tabIndex={-1}).
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

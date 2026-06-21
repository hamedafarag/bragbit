import { expect, test, type Page } from "@playwright/test";

import { E2E } from "./global-setup";

// e2e for dark mode (ENH-UX-01): the header toggle flips the theme and the choice
// survives a reload (cookie-driven SSR). Robust to the starting theme. Local
// sign-in helper mirrors core-flow.spec.ts.
async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.fill("#email", email);
  await page.fill("#password", E2E.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => new URL(url).pathname === "/dashboard", { timeout: 20_000 });
}

test("the theme toggle flips dark mode and persists across a reload", async ({ page }) => {
  await signIn(page, E2E.ownerEmail);

  const toggle = page.getByRole("button", { name: /switch to (light|dark) mode/i });
  const isDark = () => page.evaluate(() => document.documentElement.classList.contains("dark"));

  const before = await isDark();
  await toggle.click();
  const after = await isDark();
  expect(after).toBe(!before); // the toggle flipped the theme

  await page.reload();
  expect(await isDark()).toBe(after); // the cookie persisted the choice through SSR
});

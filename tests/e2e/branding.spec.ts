import { expect, test, type Page } from "@playwright/test";

import { E2E } from "./global-setup";

/**
 * Per-workspace white-labeling has to survive the portal boundary.
 *
 * Radix renders dialog content into `document.body` and the sonner Toaster mounts
 * in the root layout — both outside the app shell. While the accent lived in an
 * inline style on a layout wrapper it never reached them, so every dialog on a
 * branded workspace quietly rendered in the default orange (#e8590c). It went
 * unnoticed because the e2e org had no accent at all, which makes the bug
 * invisible; `global-setup` now brands it (E2E.accent) so this can be asserted.
 *
 * Sign-in helper mirrors templates.spec.ts / core-flow.spec.ts (no shared helper yet).
 */
async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.fill("#email", email);
  await page.fill("#password", E2E.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => new URL(url).pathname === "/dashboard", { timeout: 20_000 });
}

/** The resolved `--primary` on an element, as the browser sees it. */
function primaryOf(page: Page, selector: string) {
  return page.evaluate(
    (s) => getComputedStyle(document.querySelector(s)!).getPropertyValue("--primary").trim(),
    selector,
  );
}

test("the workspace accent reaches the app shell and portalled dialogs", async ({ page }) => {
  const docTitle = `E2E Branding ${Date.now()}`;

  await signIn(page, E2E.ownerEmail);

  await test.step("the app shell carries the workspace accent", async () => {
    expect(await primaryOf(page, "main#main-content")).toBe(E2E.accent);
  });

  await test.step("open a document", async () => {
    await page.getByRole("button", { name: "New document" }).first().click();
    await page.fill("#doc-title", docTitle);
    await page.getByRole("button", { name: "Create document" }).click();
    await page.getByRole("link", { name: docTitle }).click();
    await page.waitForURL(/\/documents\/.+/);
  });

  await test.step("the brag editor is branded, not defaulted", async () => {
    await page.getByRole("button", { name: "Led an initiative" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    expect(await primaryOf(page, '[role="dialog"]')).toBe(E2E.accent);
    // --ring drives the focus rings inside the editor.
    const ring = await page.evaluate(() =>
      getComputedStyle(document.querySelector('[role="dialog"]')!)
        .getPropertyValue("--ring")
        .trim(),
    );
    expect(ring).toBe(E2E.accent);

    await page.keyboard.press("Escape");
  });

  await test.step("the share dialog's primary button paints the workspace accent", async () => {
    await page.getByRole("button", { name: "Share" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    expect(await primaryOf(page, '[role="dialog"]')).toBe(E2E.accent);

    // The rendered pixel, not just the variable: this is what a user sees, and
    // it's what was orange before the fix.
    const create = dialog.getByRole("button", { name: "Create share link" });
    await expect(create).toHaveCSS("background-color", E2E.accentRgb);
  });
});

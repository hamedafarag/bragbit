import { expect, test, type Page } from "@playwright/test";

import { E2E } from "./global-setup";

// e2e for entry templates (ENH-UX-04): a template chip opens the editor
// pre-filled from the template, and saving creates a brag from the seeded
// fields. Local sign-in helper mirrors core-flow.spec.ts (no shared helper yet).
async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.fill("#email", email);
  await page.fill("#password", E2E.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => new URL(url).pathname === "/dashboard", { timeout: 20_000 });
}

test("entry template pre-fills the editor and logs a win", async ({ page }) => {
  const stamp = Date.now();
  const docTitle = `E2E Templates ${stamp}`;
  const winTitle = `Led the platform migration ${stamp}`;

  await signIn(page, E2E.ownerEmail);

  await test.step("create and open a document", async () => {
    await page.getByRole("button", { name: "New document" }).first().click();
    await page.fill("#doc-title", docTitle);
    await page.getByRole("button", { name: "Create document" }).click();
    await page.getByRole("link", { name: docTitle }).click();
    await page.waitForURL(/\/documents\/.+/);
  });

  await test.step("a template chip opens the editor pre-filled", async () => {
    await page.getByRole("button", { name: "Led an initiative" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Log a win" })).toBeVisible();
    // Category is seeded from the template; the description carries the scaffold.
    await expect(dialog.getByLabel("Category")).toHaveValue("leadership");
    await expect(dialog.getByLabel("Description")).toHaveValue(/What I led/);
  });

  await test.step("fill the title and save → it lands on the timeline", async () => {
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill(winTitle);
    await dialog.getByRole("button", { name: "Log win" }).click();
    await expect(page.getByText(winTitle)).toBeVisible();
  });
});

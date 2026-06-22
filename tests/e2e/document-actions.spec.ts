import { expect, test, type Page } from "@playwright/test";

import { E2E } from "./global-setup";

// The document lifecycle controls on the dashboard (DocumentActions): edit the
// title, archive then restore, and finally delete. Operates on a freshly-created
// document with a unique title, so it never collides with other specs.

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.fill("#email", email);
  await page.fill("#password", E2E.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => new URL(url).pathname === "/dashboard", { timeout: 20_000 });
}

test("document: edit, archive, restore, delete", async ({ page }) => {
  const stamp = Date.now();
  const title = `Doc Actions ${stamp}`;
  const edited = `${title} edited`;
  const card = (text: string) => page.getByRole("listitem").filter({ hasText: text });

  await signIn(page, E2E.ownerEmail);

  await test.step("create a document", async () => {
    await page.getByRole("button", { name: "New document" }).first().click();
    await page.fill("#doc-title", title);
    await page.getByRole("button", { name: "Create document" }).click();
    await expect(card(title)).toBeVisible();
  });

  await test.step("edit its title", async () => {
    await card(title).getByRole("button", { name: "Edit" }).click();
    await page.fill("#doc-title", edited);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(card(edited)).toBeVisible();
  });

  await test.step("archive then restore", async () => {
    await card(edited).getByRole("button", { name: "Archive" }).click();
    // The archived list is a collapsed <details>; expand it to reach the card.
    await page.locator("summary").filter({ hasText: "Archived" }).click();
    await expect(card(edited).getByRole("button", { name: "Restore" })).toBeVisible();
    await card(edited).getByRole("button", { name: "Restore" }).click();
    await expect(card(edited).getByRole("button", { name: "Archive" })).toBeVisible();
  });

  await test.step("delete it", async () => {
    await card(edited).getByRole("button", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete document" }).click();
    await expect(card(edited)).toHaveCount(0);
  });
});

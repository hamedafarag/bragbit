import { expect, test, type Page } from "@playwright/test";

import { E2E } from "./global-setup";

// Attaching a file to a brag and removing it — the real multipart upload route
// (/api/upload/attachment) + the scoped delete action, end to end. Uploads via the
// attachment manager's hidden file input (set directly, no OS picker). Operates on a
// freshly-created brag.

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.fill("#email", email);
  await page.fill("#password", E2E.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => new URL(url).pathname === "/dashboard", { timeout: 20_000 });
}

test("attachment: upload a file to a brag, then remove it", async ({ page }) => {
  const stamp = Date.now();
  const docTitle = `Attach Doc ${stamp}`;
  const win = `Win for attachments ${stamp}`;
  const fileName = `evidence-${stamp}.pdf`;

  await signIn(page, E2E.ownerEmail);

  await test.step("create a document with a win", async () => {
    await page.getByRole("button", { name: "New document" }).first().click();
    await page.fill("#doc-title", docTitle);
    await page.getByRole("button", { name: "Create document" }).click();
    await page.getByRole("link", { name: docTitle }).click();
    await page.waitForURL(/\/documents\/.+/);
    await page.getByPlaceholder(/Log a win/).fill(win);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(win)).toBeVisible();
  });

  await test.step("open the brag editor and attach a file", async () => {
    // The card's "Edit" (not the header's "Edit document") opens the editor.
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Edit brag" })).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({
      name: fileName,
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 e2e evidence"),
    });
    // Scope to the editor dialog — the filename also shows as a chip on the timeline
    // card behind it once router.refresh runs.
    await expect(page.getByRole("dialog").getByText(fileName)).toBeVisible({ timeout: 15_000 });
  });

  await test.step("remove the attachment", async () => {
    await page
      .getByRole("dialog")
      .getByRole("button", { name: `Remove ${fileName}` })
      .click();
    await expect(page.getByRole("dialog").getByText(fileName)).toHaveCount(0);
  });
});

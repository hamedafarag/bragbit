import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

import { E2E } from "./global-setup";

// End-to-end coverage of the product's core journey (ENH-TEST-01): an owner
// captures a win, sees it on the timeline, shares the document behind a password,
// a logged-out visitor unlocks and reads it, and the owner exports it to Markdown.
// Drives the real app stack via the UI — the biggest flow that previously had no
// e2e. Reuses the same UI sign-in as admin-gating.spec.ts (no shared helper yet).

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.fill("#email", email);
  await page.fill("#password", E2E.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => new URL(url).pathname === "/dashboard", { timeout: 20_000 });
}

test("core flow: capture → timeline → share (password) → export", async ({ page, browser }) => {
  // Unique per run so re-runs and parallel shards never collide.
  const stamp = Date.now();
  const docTitle = `E2E Core ${stamp}`;
  const win = `Shipped the realtime heatmap ${stamp}`;
  const password = "sharepass123";

  await signIn(page, E2E.ownerEmail);

  await test.step("create a document and open it", async () => {
    await page.getByRole("button", { name: "New document" }).first().click();
    await page.fill("#doc-title", docTitle);
    await page.getByRole("button", { name: "Create document" }).click();
    // The dialog closes and the dashboard refreshes with the new document card.
    await page.getByRole("link", { name: docTitle }).click();
    await page.waitForURL(/\/documents\/.+/);
  });

  await test.step("capture a win and see it on the timeline", async () => {
    await page.getByPlaceholder(/Log a win/).fill(win);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(win)).toBeVisible();
  });

  let shareUrl = "";
  await test.step("share the document behind a password", async () => {
    await page.getByRole("button", { name: "Share" }).click();
    await page.getByRole("button", { name: "Create share link" }).click();
    shareUrl = await page.getByLabel("Share link").inputValue();
    expect(shareUrl).toContain("/share/");

    await page.getByLabel("Share password").fill(password);
    await page.getByRole("button", { name: "Set", exact: true }).click();
    // Local state flips immediately once the action resolves.
    await expect(page.getByText("Protected")).toBeVisible();
    await page.keyboard.press("Escape"); // close the dialog
  });

  await test.step("a logged-out visitor must unlock before reading", async () => {
    // A fresh context carries no auth cookies — a true public visitor.
    const guestCtx = await browser.newContext();
    const guest = await guestCtx.newPage();
    try {
      await guest.goto(shareUrl);
      await expect(guest.getByRole("heading", { name: "Password required" })).toBeVisible();

      // Wrong password is rejected …
      await guest.fill("#share-password", "nope-wrong");
      await guest.getByRole("button", { name: "Unlock" }).click();
      await expect(guest.getByText("Incorrect password. Try again.")).toBeVisible();

      // … and the correct one reveals the shared timeline.
      await guest.fill("#share-password", password);
      await guest.getByRole("button", { name: "Unlock" }).click();
      await expect(guest.getByText(win)).toBeVisible();
    } finally {
      await guestCtx.close();
    }
  });

  await test.step("export the document to Markdown", async () => {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export" }).click();
    await page.getByRole("button", { name: "Download Markdown" }).click();
    const download = await downloadPromise;
    const path = await download.path();
    const markdown = await readFile(path, "utf8");
    expect(markdown).toContain(docTitle);
    expect(markdown).toContain(win);
  });
});

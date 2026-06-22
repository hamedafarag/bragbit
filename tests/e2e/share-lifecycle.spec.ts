import { expect, test, type Browser, type Page } from "@playwright/test";

import { E2E } from "./global-setup";

// The owner-side share lifecycle (the half core-flow doesn't cover): rotating a link
// mints a fresh token and kills the old one, and revoking stops sharing entirely. A
// logged-out visitor is the oracle — the old/revoked token 404s, the live one shows
// the win. Operates on a freshly-created document.

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.fill("#email", email);
  await page.fill("#password", E2E.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => new URL(url).pathname === "/dashboard", { timeout: 20_000 });
}

/** Visit a share URL in a fresh (logged-out) context; returns the HTTP status. */
async function guestStatus(browser: Browser, url: string): Promise<number> {
  const ctx = await browser.newContext();
  try {
    const res = await ctx.newPage().then((p) => p.goto(url));
    return res?.status() ?? 0;
  } finally {
    await ctx.close();
  }
}

/** Visit a share URL logged-out and assert the win is visible. */
async function guestSeesWin(browser: Browser, url: string, win: string) {
  const ctx = await browser.newContext();
  try {
    const guest = await ctx.newPage();
    await guest.goto(url);
    await expect(guest.getByText(win)).toBeVisible();
  } finally {
    await ctx.close();
  }
}

test("share: create → rotate (old link dies) → revoke (new link dies)", async ({
  page,
  browser,
}) => {
  const stamp = Date.now();
  const docTitle = `Share Lifecycle ${stamp}`;
  const win = `Shipped the realtime heatmap ${stamp}`;

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

  let url1 = "";
  await test.step("create a share link; the public view shows the win", async () => {
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await page.getByRole("button", { name: "Create share link" }).click();
    url1 = await page.getByLabel("Share link").inputValue();
    expect(url1).toContain("/share/");
    await guestSeesWin(browser, url1, win);
  });

  let url2 = "";
  await test.step("rotate: a new token; the old one 404s", async () => {
    await page.getByRole("button", { name: "Rotate link" }).click();
    await expect(page.getByLabel("Share link")).not.toHaveValue(url1);
    url2 = await page.getByLabel("Share link").inputValue();
    expect(url2).not.toBe(url1);
    expect(await guestStatus(browser, url1)).toBe(404);
    await guestSeesWin(browser, url2, win);
  });

  await test.step("revoke: the live token 404s too", async () => {
    await page.getByRole("button", { name: "Stop sharing" }).click();
    await expect(page.getByRole("button", { name: "Create share link" })).toBeVisible();
    expect(await guestStatus(browser, url2)).toBe(404);
  });
});

import { expect, test, type Page } from "@playwright/test";

import { E2E } from "./global-setup";

// Timeline cursor pagination (PERF-01): the seeded document holds 16 June + 16 May
// + 6 March wins. The first page fills with June+May (target 30, whole months);
// March — with a quiet April before it — loads on demand via "Load more", and the
// cross-page quiet-month marker only appears once that older page is in.

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.fill("#email", email);
  await page.fill("#password", E2E.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => new URL(url).pathname === "/dashboard", { timeout: 20_000 });
}

test("timeline pages older months in with Load more", async ({ page }) => {
  await signIn(page, E2E.paginate.email);
  await page.goto(E2E.paginate.docPath);

  // Brag titles render as buttons (they open the detail dialog); match exactly so
  // "June win 1" doesn't also catch "June win 10"…"16".
  const win = (name: string) => page.getByRole("button", { name, exact: true });

  // First page: June and May are present; March has not loaded yet.
  await expect(win("June win 1")).toBeVisible();
  await expect(win("May win 1")).toBeVisible();
  await expect(win("March win 1")).toHaveCount(0);
  // The boundary quiet-month marker is not shown until the older page arrives.
  await expect(page.getByText(/quiet month/)).toHaveCount(0);

  const loadMore = page.getByRole("button", { name: "Load more" });
  await expect(loadMore).toBeVisible();
  await loadMore.click();

  // The older month appends, with the quiet April between May and March marked.
  await expect(win("March win 1")).toBeVisible();
  await expect(page.getByText(/1 quiet month/)).toBeVisible();
  // June was not re-rendered into a second header, and nothing more remains.
  await expect(page.getByRole("heading", { name: "June", exact: true })).toHaveCount(1);
  await expect(loadMore).toHaveCount(0);
});

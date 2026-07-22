import { expect, test, type Page } from "@playwright/test";

import { E2E } from "./global-setup";

/**
 * Regression guard for the members-table layout.
 *
 * The admin/members table (5 columns) used to be boxed into the 760px prose
 * `<main>` shell, so its ~750px natural width overran the card: dates wrapped to
 * three lines and the row separators spilled ~40px past the card's right edge.
 * The admin area now breaks out to a wider, viewport-centered column
 * (`.content-wide`), so the table fits inside its card.
 *
 * Asserted geometrically (same computed-measurement approach as branding.spec.ts)
 * rather than by pixel snapshot, so it's robust to fonts and row count.
 *
 * Sign-in helper mirrors admin-gating.spec.ts / branding.spec.ts (no shared helper yet).
 */
test.use({ viewport: { width: 1280, height: 800 } });

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.fill("#email", email);
  await page.fill("#password", E2E.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => new URL(url).pathname === "/dashboard", { timeout: 20_000 });
}

test("the members table uses the wide admin column and stays within its card", async ({ page }) => {
  await signIn(page, E2E.ownerEmail);
  await page.goto("/admin/members");

  // The table renders with the seeded owner (+ member) rows.
  const table = page.locator("main table");
  await expect(table).toBeVisible();
  await expect(table.getByText(E2E.ownerEmail)).toBeVisible();

  const metrics = await page.evaluate(() => {
    const table = document.querySelector("main table");
    if (!table) return null;
    const card = table.closest("section")!;
    const scroller = table.parentElement!; // the overflow-x-auto wrapper
    const doc = document.documentElement;
    return {
      cardWidth: Math.round(card.getBoundingClientRect().width),
      tableOverflowInCard: Math.round(scroller.scrollWidth - scroller.clientWidth),
      pageOverflow: Math.round(doc.scrollWidth - doc.clientWidth),
    };
  });

  expect(metrics).not.toBeNull();
  // The admin area breaks out of the 760px prose shell (content-wide ≈ 1024px).
  expect(metrics!.cardWidth).toBeGreaterThan(800);
  // The table fits its card — no horizontal scroll, no separators past the edge.
  expect(metrics!.tableOverflowInCard).toBeLessThanOrEqual(1);
  // The breakout never introduces a page-level horizontal scrollbar.
  expect(metrics!.pageOverflow).toBeLessThanOrEqual(1);
});

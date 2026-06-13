import { expect, test } from "@playwright/test";

test("home page renders the document header", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /2026/ })).toBeVisible();
  await expect(page.getByText("the year of shipping")).toBeVisible();
});

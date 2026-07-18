import { expect, test, type Page } from "@playwright/test";

import { E2E, E2E_INTEGRATIONS } from "./global-setup";

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.fill("#email", email);
  await page.fill("#password", E2E.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => new URL(url).pathname === "/dashboard", { timeout: 20_000 });
}

// Drives the approve-each-entry review queue end-to-end against pre-seeded import
// candidates (E2E_INTEGRATIONS) — no GitHub involved. Proves the browser flow the
// unit/integration tests can't: a real user approving a candidate into a document
// and dismissing another.
test("import review queue: approve one candidate into a document, dismiss another", async ({
  page,
}) => {
  await signIn(page, E2E_INTEGRATIONS.email);

  await page.goto("/settings");
  const integrations = page.locator("#integrations");

  // The seeded GitHub connection shows connected, with both candidates queued.
  await expect(integrations.getByText("octocat")).toBeVisible();
  await expect(integrations.getByText("Ship the crew heatmap")).toBeVisible();
  await expect(integrations.getByText("Fix the flaky import test")).toBeVisible();

  // Approve the first candidate — the lone document is the default target.
  await integrations
    .locator("li", { hasText: "Ship the crew heatmap" })
    .getByRole("button", { name: "Approve" })
    .click();
  // It leaves the review queue…
  await expect(integrations.getByText("Ship the crew heatmap")).toHaveCount(0);

  // …and now lives in the document as a brag.
  await page.goto(`/documents/${E2E_INTEGRATIONS.docId}`);
  await expect(page.getByText("Ship the crew heatmap")).toBeVisible();

  // Dismiss the other candidate; it just leaves the queue (no brag).
  await page.goto("/settings");
  const queue = page.locator("#integrations");
  await queue
    .locator("li", { hasText: "Fix the flaky import test" })
    .getByRole("button", { name: "Dismiss" })
    .click();
  await expect(queue.getByText("Fix the flaky import test")).toHaveCount(0);
});

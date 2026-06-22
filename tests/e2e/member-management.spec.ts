import { expect, test, type Page } from "@playwright/test";

import { E2E } from "./global-setup";

// Owner-side member management on /admin/members: promote a member to admin, remove
// a member, and transfer ownership. Runs against a dedicated org (its own owner +
// two members) so the shared e2e-org is never mutated. One test with ordered steps
// — transfer is last, since it demotes the acting owner to admin.

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.fill("#email", email);
  await page.fill("#password", E2E.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => new URL(url).pathname === "/dashboard", { timeout: 20_000 });
}

test("member management: change role, remove a member, transfer ownership", async ({ page }) => {
  const mm = E2E.memberMgmt;
  const row = (email: string) => page.getByRole("row").filter({ hasText: email });

  await signIn(page, mm.ownerEmail);
  await page.goto("/admin/members");
  await expect(page.getByRole("heading", { name: "Members", exact: true })).toBeVisible();

  await test.step("promote a member to admin", async () => {
    await row(mm.aliceEmail).getByLabel("Member role").selectOption("admin");
    await expect(page.getByText("Role updated.")).toBeVisible();
    await page.reload();
    await expect(row(mm.aliceEmail).getByLabel("Member role")).toHaveValue("admin");
  });

  await test.step("remove a member", async () => {
    await row(mm.bobEmail).getByRole("button", { name: "Remove" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove member" }).click();
    await expect(row(mm.bobEmail)).toHaveCount(0);
  });

  await test.step("transfer ownership", async () => {
    await row(mm.aliceEmail).getByRole("button", { name: "Make owner" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Make owner" }).click();
    await page.reload();
    // Alice is now the owner (a non-editable badge); the former owner is an admin.
    await expect(row(mm.aliceEmail)).toContainText(/owner/i);
    await expect(row(mm.ownerEmail)).toContainText(/admin/i);
  });
});

import { expect, test, type Page } from "@playwright/test";

import { E2E } from "./global-setup";

// The settings/management surfaces that had unit coverage but no e2e: profile edit +
// avatar upload (/profile), weekly reminders (/settings), and workspace branding +
// logo upload (/admin). One owner of a dedicated org drives all of it; persisted
// state is asserted after a reload (toasts are transient), and uploads by the image
// that appears once the file is stored.

// A real 1x1 PNG, so the thumbnailing file route is happy.
const PNG = {
  name: "pic.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  ),
};

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.fill("#email", email);
  await page.fill("#password", E2E.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => new URL(url).pathname === "/dashboard", { timeout: 20_000 });
}

test("settings cluster: profile, avatar, reminders, branding, logo", async ({ page }) => {
  await signIn(page, E2E.settings.ownerEmail);

  await test.step("edit the profile display name", async () => {
    await page.goto("/profile");
    await page.getByLabel("Display name").fill("Renamed Owner");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Display name")).toHaveValue("Renamed Owner");
  });

  await test.step("upload an avatar", async () => {
    await page.locator('input[type="file"]').setInputFiles(PNG);
    await expect(page.getByAltText("Your avatar")).toBeVisible({ timeout: 15_000 });
  });

  await test.step("enable weekly reminders", async () => {
    await page.goto("/settings");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Save reminder settings" }).click();
    await expect(page.getByText("Reminder settings saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("checkbox")).toBeChecked();
  });

  await test.step("change the workspace name (branding)", async () => {
    await page.goto("/admin");
    await page.getByLabel("Workspace name").fill("Renamed Org");
    await page.getByRole("button", { name: "Save branding" }).click();
    await expect(page.getByText("Branding saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Workspace name")).toHaveValue("Renamed Org");
  });

  await test.step("upload a workspace logo", async () => {
    await page.locator('input[type="file"]').setInputFiles(PNG);
    await expect(page.getByAltText(/logo/)).toBeVisible({ timeout: 15_000 });
  });
});

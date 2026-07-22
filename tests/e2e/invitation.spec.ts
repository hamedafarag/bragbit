import postgres from "postgres";

import { expect, test } from "@playwright/test";

import { E2E } from "./global-setup";

// E2E for the invitation accept flow (ENH-TEST-02): a logged-out invitee opens
// the invite link, sets up their account, and lands in the workspace. The accept
// path runs the REAL Better Auth sign-up (which sends a verification email), so
// the e2e env needs SMTP/Mailpit (dev stack locally; a mailpit service in CI).
//
// global-setup seeds the pending invitation; this resets state before each
// attempt so retries (and re-runs) start clean — registering the invitee creates
// a real user and accepting flips the invitation to "accepted".
const sql = postgres(process.env.DATABASE_URL ?? "");

test.beforeEach(async () => {
  await sql`delete from "user" where email = ${E2E.inviteeEmail}`;
  await sql`update invitation set status = 'pending' where id = ${E2E.inviteId}`;
});

test.afterAll(async () => {
  await sql.end();
});

test("an invitee sets up their account and joins the workspace", async ({ page }) => {
  await page.goto(`/accept-invitation/${E2E.inviteId}`);
  await expect(page.getByRole("heading", { name: "Join E2E Org" })).toBeVisible();
  // The email is fixed by the invitation (disabled field); the invitee sets the rest.
  await expect(page.locator("#invite-email")).toHaveValue(E2E.inviteeEmail);

  await page.fill("#name", "Invited Person");
  await page.fill("#password", "InviteePass123");
  await page.getByRole("button", { name: "Join E2E Org" }).click();

  // The flow runs register → accept → a full-page redirect to the dashboard.
  // Assert the real outcome — the invitee is now a member of the workspace — by
  // polling the DB (robust to dev-server nav timing).
  await expect
    .poll(
      async () => {
        const [row] = await sql`
          select m.role from member m
          join "user" u on u.id = m.user_id
          where u.email = ${E2E.inviteeEmail} and m.organization_id = 'e2e-org'`;
        return row?.role ?? null;
      },
      { timeout: 20_000 },
    )
    .toBe("member");

  // …and that the redirect actually lands them in the app. Regression guard: the
  // old soft redirect (router.push + refresh) raced the accept action's route
  // revalidation and stranded the invitee on the form.
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
});

test("an unknown invitation shows the unavailable state", async ({ page }) => {
  await page.goto(`/accept-invitation/does-not-exist`);
  await expect(page.getByRole("heading", { name: "Invitation unavailable" })).toBeVisible();
});

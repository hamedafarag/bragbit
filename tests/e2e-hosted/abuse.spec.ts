import { hashPassword } from "better-auth/crypto";
import postgres from "postgres";

import { expect, test } from "@playwright/test";

// Hosted-mode e2e (PLAN §10 abuse controls): a disposable-email signup is rejected,
// and an attachment upload is blocked once a workspace is over its storage quota.
const HOSTED_DB_URL =
  process.env.HOSTED_DATABASE_URL ?? "postgres://bragbit:bragbit@localhost:5433/bragbit_e2e_hosted";
const sql = postgres(HOSTED_DB_URL, { onnotice: () => {} });

const DISPOSABLE_EMAIL = "throwaway-e2e@mailinator.com";

const QUOTA = {
  id: "e2e-quota",
  name: "Quota User",
  email: "quota-e2e@bragbit.local",
  password: "quotapass123",
  personal: "e2e-quota-personal",
  doc: "e2e-quota-doc",
  brag: "e2e-quota-brag",
};

test.beforeAll(async () => {
  await sql`delete from "user" where id in (${QUOTA.id}) or email = ${DISPOSABLE_EMAIL}`;
  await sql`delete from organization where id = ${QUOTA.personal}`;
  const pw = await hashPassword(QUOTA.password);
  await sql`insert into "user" (id, name, email, email_verified) values (${QUOTA.id}, ${QUOTA.name}, ${QUOTA.email}, true)`;
  await sql`insert into account (id, account_id, provider_id, user_id, password)
            values ('e2e-quota-acct', ${QUOTA.id}, 'credential', ${QUOTA.id}, ${pw})`;
  // A personal workspace with a 1 MB quota, already full (a 1 MB attachment seeded).
  await sql`insert into organization (id, name, slug, type, storage_quota_mb)
            values (${QUOTA.personal}, ${"Quota User's Logbook"}, 'e2e-quota-personal', 'personal', 1)`;
  await sql`insert into member (id, organization_id, user_id, role)
            values ('e2e-quota-mem', ${QUOTA.personal}, ${QUOTA.id}, 'owner')`;
  await sql`insert into documents (id, workspace_id, user_id, title)
            values (${QUOTA.doc}, ${QUOTA.personal}, ${QUOTA.id}, 'Doc')`;
  await sql`insert into brags (id, document_id, title) values (${QUOTA.brag}, ${QUOTA.doc}, 'Brag')`;
  await sql`insert into attachments (id, brag_id, storage_key, file_name, mime_type, size_bytes)
            values ('e2e-quota-att', ${QUOTA.brag}, 'fake/key.png', 'big.png', 'image/png', 1048576)`;
});

test.afterAll(async () => {
  await sql`delete from "user" where id = ${QUOTA.id} or email = ${DISPOSABLE_EMAIL}`;
  await sql`delete from organization where id = ${QUOTA.personal}`;
  await sql.end();
});

test("open signup rejects a disposable-email address", async ({ page }) => {
  await sql`delete from "user" where email = ${DISPOSABLE_EMAIL}`;
  await page.goto("/sign-up");
  await page.fill("#name", "Throwaway");
  await page.fill("#email", DISPOSABLE_EMAIL);
  await page.fill("#password", "password123");
  await page.getByRole("button", { name: "Create account" }).click();

  // The user-create before-hook aborts: no account is created, and we never reach
  // the verify-email page (the form toasts the error and stays put).
  await expect
    .poll(
      async () => {
        const [row] = await sql`select 1 from "user" where email = ${DISPOSABLE_EMAIL}`;
        return row ? "created" : "none";
      },
      { timeout: 10_000 },
    )
    .toBe("none");
  await expect(page).toHaveURL(/\/sign-up/);
});

test("attachment upload is blocked when the workspace is over its storage quota", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.fill("#email", QUOTA.email);
  await page.fill("#password", QUOTA.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => new URL(url).pathname === "/dashboard", { timeout: 20_000 });

  // page.request shares the signed-in session cookie. The workspace is already at its
  // 1 MB quota, so any upload is rejected before storage.
  const resp = await page.request.post("/api/upload/attachment", {
    multipart: {
      bragId: QUOTA.brag,
      files: {
        name: "tiny.png",
        mimeType: "image/png",
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      },
    },
  });
  expect(resp.status()).toBe(413);
});

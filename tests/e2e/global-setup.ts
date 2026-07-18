import { hashPassword } from "better-auth/crypto";
import postgres from "postgres";

/**
 * Seeds a fixed organization workspace with an owner and a member straight into
 * the database (credential accounts hashed with Better Auth's own hasher), so the
 * e2e suite can sign in as each and exercise the real `/admin` role gate. Runs
 * once before the suite and is idempotent. Uses raw SQL + the `postgres` driver
 * only — no app modules — so it stays independent of the running server.
 */
export const E2E = {
  password: "E2eTest1234!",
  ownerEmail: "owner@e2e.test",
  memberEmail: "member@e2e.test",
  // A deliberately NON-default accent (the default is #e8590c). White-labeling
  // bugs are invisible on a workspace that happens to use the fallback color —
  // that blind spot is exactly how dialogs shipped unbranded — so the e2e org is
  // branded and `branding.spec.ts` asserts the accent reaches portalled surfaces.
  accent: "#4338ca",
  accentRgb: "rgb(67, 56, 202)",
  // A pending invitation the accept-flow spec drives. The invitee registers via
  // the real Better Auth sign-up (so the e2e env needs SMTP/Mailpit).
  inviteId: "e2e-invite",
  inviteeEmail: "invitee@e2e.test",
};

// An isolated fixture for integrations.spec: its own user + personal workspace, a
// document to approve into, a GitHub connection (placeholder token — the review /
// approve / dismiss path never decrypts it), and two pending import candidates. Kept
// separate from the owner/member above so it can't race the parallel org specs.
export const E2E_INTEGRATIONS = {
  email: "integrations@e2e.test",
  userId: "e2e-int-user",
  orgId: "e2e-int-org",
  connId: "e2e-int-conn",
  docId: "e2e-int-doc",
  candidates: [
    ["101", "Ship the crew heatmap"],
    ["102", "Fix the flaky import test"],
  ] as const,
};

const SEED = [
  ["e2e-owner", "E2E Owner", E2E.ownerEmail, "owner"],
  ["e2e-member", "E2E Member", E2E.memberEmail, "member"],
] as const;

export default async function globalSetup() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("e2e: DATABASE_URL is not set");

  const sql = postgres(url);
  try {
    const password = await hashPassword(E2E.password);

    // Reset prior e2e rows (deleting a user cascades its account + membership).
    // The invitee is created by the accept-flow spec, so clear it by email too.
    await sql`delete from "user" where id in ('e2e-owner', 'e2e-member')`;
    await sql`delete from "user" where email = ${E2E.inviteeEmail}`;
    await sql`delete from organization where id = 'e2e-org'`;

    await sql`insert into organization (id, name, slug, type, accent_color)
              values ('e2e-org', 'E2E Org', 'e2e-org', 'organization', ${E2E.accent})`;

    for (const [uid, name, email, role] of SEED) {
      await sql`insert into "user" (id, name, email, email_verified)
                values (${uid}, ${name}, ${email}, true)`;
      await sql`insert into account (id, account_id, provider_id, user_id, password)
                values (${`${uid}-acc`}, ${uid}, 'credential', ${uid}, ${password})`;
      await sql`insert into member (id, organization_id, user_id, role)
                values (${`${uid}-mem`}, 'e2e-org', ${uid}, ${role})`;
    }

    // A pending invitation for the accept-flow spec (inviter = the owner).
    await sql`insert into invitation (id, organization_id, email, role, status, expires_at, inviter_id)
              values (${E2E.inviteId}, 'e2e-org', ${E2E.inviteeEmail}, 'member', 'pending',
                      now() + interval '7 days', 'e2e-owner')`;

    // --- Integrations fixture (see E2E_INTEGRATIONS) ---
    const I = E2E_INTEGRATIONS;
    await sql`delete from "user" where id = ${I.userId}`; // cascades member/document/connection/candidates
    await sql`delete from organization where id = ${I.orgId}`;

    await sql`insert into organization (id, name, slug, type)
              values (${I.orgId}, 'Integrations E2E', 'integrations-e2e', 'personal')`;
    await sql`insert into "user" (id, name, email, email_verified)
              values (${I.userId}, 'Integrations E2E', ${I.email}, true)`;
    await sql`insert into account (id, account_id, provider_id, user_id, password)
              values ('e2e-int-acc', ${I.userId}, 'credential', ${I.userId}, ${password})`;
    await sql`insert into member (id, organization_id, user_id, role)
              values ('e2e-int-mem', ${I.orgId}, ${I.userId}, 'owner')`;
    await sql`insert into documents (id, workspace_id, user_id, title)
              values (${I.docId}, ${I.orgId}, ${I.userId}, 'Imports 2026')`;
    await sql`insert into integration_connection
                (id, user_id, workspace_id, provider, auth_type, external_account_id,
                 external_account_label, access_token)
              values (${I.connId}, ${I.userId}, ${I.orgId}, 'github', 'pat', '42', 'octocat',
                      'seeded-placeholder')`;
    for (const [ext, title] of I.candidates) {
      await sql`insert into import_candidate
                  (id, connection_id, user_id, workspace_id, provider, external_id, external_url,
                   source_type, title, suggested_category, status)
                values (${`e2e-int-cand-${ext}`}, ${I.connId}, ${I.userId}, ${I.orgId}, 'github',
                        ${`PR_${ext}`}, ${`https://github.com/acme/web/pull/${ext}`}, 'pull_request',
                        ${title}, 'shipped-work', 'pending')`;
    }
  } finally {
    await sql.end();
  }
}

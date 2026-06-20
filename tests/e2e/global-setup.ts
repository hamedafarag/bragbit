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
  // A pending invitation the accept-flow spec drives. The invitee registers via
  // the real Better Auth sign-up (so the e2e env needs SMTP/Mailpit).
  inviteId: "e2e-invite",
  inviteeEmail: "invitee@e2e.test",
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

    await sql`insert into organization (id, name, slug, type)
              values ('e2e-org', 'E2E Org', 'e2e-org', 'organization')`;

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
  } finally {
    await sql.end();
  }
}

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
  // A personal workspace whose one document carries enough brags across enough
  // months to split the timeline into two cursor-paged pages (PERF-01).
  paginate: {
    email: "paginate@e2e.test",
    userId: "e2e-paginate",
    wsId: "e2e-paginate-ws",
    docId: "e2e-paginate-doc",
    docPath: "/documents/e2e-paginate-doc",
  },
  // Throwaway personal-workspace accounts for the settings flows, so the shared
  // owner/member fixture is never mutated: changePw flips its own password, delete
  // destroys itself — both re-seeded fresh each run.
  accounts: {
    changePw: { email: "acct-pw@e2e.test", userId: "e2e-acct-pw", wsId: "e2e-acct-pw-ws" },
    del: { email: "acct-del@e2e.test", userId: "e2e-acct-del", wsId: "e2e-acct-del-ws" },
  },
  // A dedicated org + owner + two members for the member-management flows (role
  // change, removal, ownership transfer) — kept off the shared e2e-org.
  memberMgmt: {
    orgId: "e2e-mm-org",
    ownerEmail: "mm-owner@e2e.test",
    ownerId: "e2e-mm-owner",
    aliceEmail: "mm-alice@e2e.test",
    aliceId: "e2e-mm-alice",
    bobEmail: "mm-bob@e2e.test",
    bobId: "e2e-mm-bob",
  },
};

// Brags per month for the pagination document, newest first. 16 + 16 fills the
// first page (target 30, whole months); the older month (with a quiet gap before
// it) spills onto page two via "load more".
const PAGINATE_MONTHS: [string, number, string][] = [
  ["2026-06", 16, "June win"],
  ["2026-05", 16, "May win"],
  ["2026-03", 6, "March win"],
];

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

    // The pagination fixture: a personal workspace, its owner, one document, and
    // brags spread across months (explicit deletes — no reliance on cascade order).
    const pg = E2E.paginate;
    await sql`delete from brags where document_id = ${pg.docId}`;
    await sql`delete from documents where id = ${pg.docId}`;
    await sql`delete from "user" where id = ${pg.userId}`;
    await sql`delete from organization where id = ${pg.wsId}`;

    await sql`insert into organization (id, name, slug, type)
              values (${pg.wsId}, 'Pagination WS', ${pg.wsId}, 'personal')`;
    await sql`insert into "user" (id, name, email, email_verified)
              values (${pg.userId}, 'Paginate User', ${pg.email}, true)`;
    await sql`insert into account (id, account_id, provider_id, user_id, password)
              values (${`${pg.userId}-acc`}, ${pg.userId}, 'credential', ${pg.userId}, ${password})`;
    await sql`insert into member (id, organization_id, user_id, role)
              values (${`${pg.userId}-mem`}, ${pg.wsId}, ${pg.userId}, 'owner')`;
    await sql`insert into documents (id, workspace_id, user_id, title)
              values (${pg.docId}, ${pg.wsId}, ${pg.userId}, 'Pagination Log')`;

    let n = 0;
    for (const [month, count, label] of PAGINATE_MONTHS) {
      for (let j = 0; j < count; j++) {
        await sql`insert into brags (id, document_id, title, date)
                  values (${`e2e-pg-${n}`}, ${pg.docId}, ${`${label} ${j + 1}`}, ${`${month}-15`})`;
        n++;
      }
    }

    // Settings-flow accounts: each a personal workspace of one (owner).
    for (const a of [E2E.accounts.changePw, E2E.accounts.del]) {
      await sql`delete from "user" where id = ${a.userId}`;
      await sql`delete from organization where id = ${a.wsId}`;
      await sql`insert into organization (id, name, slug, type)
                values (${a.wsId}, 'Settings WS', ${a.wsId}, 'personal')`;
      await sql`insert into "user" (id, name, email, email_verified)
                values (${a.userId}, 'Settings User', ${a.email}, true)`;
      await sql`insert into account (id, account_id, provider_id, user_id, password)
                values (${`${a.userId}-acc`}, ${a.userId}, 'credential', ${a.userId}, ${password})`;
      await sql`insert into member (id, organization_id, user_id, role)
                values (${`${a.userId}-mem`}, ${a.wsId}, ${a.userId}, 'owner')`;
    }

    // Member-management org: an owner plus two members to manage.
    const mm = E2E.memberMgmt;
    await sql`delete from "user" where id in (${mm.ownerId}, ${mm.aliceId}, ${mm.bobId})`;
    await sql`delete from organization where id = ${mm.orgId}`;
    await sql`insert into organization (id, name, slug, type)
              values (${mm.orgId}, 'Member Mgmt Org', ${mm.orgId}, 'organization')`;
    const mmSeed = [
      [mm.ownerId, "MM Owner", mm.ownerEmail, "owner"],
      [mm.aliceId, "MM Alice", mm.aliceEmail, "member"],
      [mm.bobId, "MM Bob", mm.bobEmail, "member"],
    ] as const;
    for (const [uid, name, email, role] of mmSeed) {
      await sql`insert into "user" (id, name, email, email_verified)
                values (${uid}, ${name}, ${email}, true)`;
      await sql`insert into account (id, account_id, provider_id, user_id, password)
                values (${`${uid}-acc`}, ${uid}, 'credential', ${uid}, ${password})`;
      await sql`insert into member (id, organization_id, user_id, role)
                values (${`${uid}-mem`}, ${mm.orgId}, ${uid}, ${role})`;
    }
  } finally {
    await sql.end();
  }
}

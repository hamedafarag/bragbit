// Seed a self-contained demo into a freshly-migrated database: a personal
// workspace, an owner you can sign in as, and a sample "2026" document with a
// handful of brags that show off the timeline (shipped + in-progress, shared +
// private, a recognition quote, collaborators, links, and tags).
//
//   pnpm seed:demo        # against the database in your .env (the dev stack)
//
// Idempotent — it wipes its own fixed-id rows first, so re-running resets the
// demo to a known state. Uses raw SQL + the `postgres` driver and Better Auth's
// password hasher only (no app modules), like the e2e seed, so it stays
// independent of the running server. Intended for a private (self-host) instance
// on a fresh database; on a private-org instance the workspace is created as an
// organization instead of a personal one.
import "dotenv/config";

import { hashPassword } from "better-auth/crypto";
import postgres from "postgres";

const DEMO = {
  email: "demo@bragbit.local",
  password: "demobragbit",
  name: "Riley Chen",
  workspace: "Riley's Logbook",
  // Fixed ids so a re-seed cleanly replaces the prior demo (delete cascades).
  userId: "demo-user",
  orgId: "demo-workspace",
  docId: "demo-doc-2026",
};

// status: shipped | in_progress · visibility: shared | private (default shared)
const BRAGS = [
  {
    id: "demo-brag-jun",
    date: "2026-06-12",
    category: "shipped-work",
    status: "shipped",
    title: "Shipped the real-time crew heatmap to production",
    description:
      "Led rollout across 14 active sites. Re-worked stream ingestion with the data team so crew positions render in under a second.",
    impact: "Site managers locate idle crews 4× faster — 22 min → 5 min average",
    collaborators: ["Data team", "N. Osei"],
    links: [{ url: "https://github.com/bragbit/demo/pull/1482", label: "PR #1482" }],
    tags: ["realtime", "platform"],
  },
  {
    id: "demo-brag-may",
    date: "2026-05-20",
    category: "recognition-feedback",
    title: "Recognized for the gateway-outage response",
    description:
      '> "Riley unblocked the entire firmware team during the gateway outage — calm, methodical, and unbelievably fast."',
    attribution: "Sara M., Director of Engineering",
  },
  {
    id: "demo-brag-apr",
    date: "2026-04-08",
    category: "collaboration-mentoring",
    status: "shipped",
    title: "Mentored two engineers to independent on-call",
    description:
      "Paired weekly on incident runbooks and observability; both now lead incidents without a shadow.",
    impact: "On-call rotation widened 6 → 8 people; mean time-to-ack down 35%",
    tags: ["mentoring"],
  },
  {
    id: "demo-brag-mar",
    date: "2026-03-15",
    category: "technical-contribution",
    status: "shipped",
    visibility: "private",
    title: "Cut the CI pipeline from 31 min to 9 min",
    description:
      "Profiled the suite, parallelized integration jobs, and moved image builds to a cached runner.",
    impact: "3.4× faster CI · ≈40 engineer-hours/week recovered",
    links: [{ url: "https://github.com/bragbit/demo/pull/1431", label: "PR #1431" }],
    tags: ["ci", "devex"],
  },
  {
    id: "demo-brag-feb",
    date: "2026-02-03",
    category: "skills-learning",
    status: "in_progress",
    title: "Deep-diving Postgres query planning",
    description:
      "Working through `EXPLAIN ANALYZE` on the slowest endpoints; already rewrote two N+1s into batched loads.",
    tags: ["postgres", "performance"],
  },
];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[seed:demo] DATABASE_URL is not set (copy .env.example → .env)");
  process.exit(1);
}

const workspaceType = process.env.INSTANCE_MODE === "private-org" ? "organization" : "personal";
const sql = postgres(url, { max: 1 });

try {
  const password = await hashPassword(DEMO.password);

  // Idempotent reset — deleting the user + organization cascades the account,
  // membership, profile, document → brags → links/tags, so a re-seed is clean.
  await sql`delete from "user" where id = ${DEMO.userId}`;
  await sql`delete from organization where id = ${DEMO.orgId}`;

  // Workspace + owner.
  await sql`insert into organization (id, name, slug, type, accent_color)
            values (${DEMO.orgId}, ${DEMO.workspace}, 'demo', ${workspaceType}, '#e8590c')`;
  await sql`insert into "user" (id, name, email, email_verified)
            values (${DEMO.userId}, ${DEMO.name}, ${DEMO.email}, true)`;
  await sql`insert into account (id, account_id, provider_id, user_id, password)
            values ('demo-account', ${DEMO.userId}, 'credential', ${DEMO.userId}, ${password})`;
  await sql`insert into member (id, organization_id, user_id, role)
            values ('demo-member', ${DEMO.orgId}, ${DEMO.userId}, 'owner')`;
  await sql`insert into profiles (user_id, display_name, role_title, team)
            values (${DEMO.userId}, ${DEMO.name}, 'Staff Engineer', 'Platform')`;

  // The sample document.
  await sql`insert into documents (id, workspace_id, user_id, title, description, period_start, period_end, goals_md)
            values (${DEMO.docId}, ${DEMO.orgId}, ${DEMO.userId}, '2026', 'The year of shipping',
                    '2026-01-01', '2026-12-31',
                    ${"Own realtime platform reliability · grow toward Staff scope · mentor two juniors to independence."})`;

  // Brags, plus their links and tags.
  for (const b of BRAGS) {
    await sql`insert into brags
                (id, document_id, title, description_md, impact_md, date, category, status, visibility, collaborators, attribution)
              values
                (${b.id}, ${DEMO.docId}, ${b.title}, ${b.description ?? null}, ${b.impact ?? null},
                 ${b.date}, ${b.category ?? null}, ${b.status ?? null}, ${b.visibility ?? "shared"},
                 ${b.collaborators ?? null}, ${b.attribution ?? null})`;

    for (const [i, link] of (b.links ?? []).entries()) {
      await sql`insert into brag_links (id, brag_id, url, label, position)
                values (${`${b.id}-link-${i}`}, ${b.id}, ${link.url}, ${link.label}, ${i})`;
    }

    for (const name of b.tags ?? []) {
      const tagId = `demo-tag-${name}`;
      // Tags are unique per (user, workspace, name); create-or-found.
      await sql`insert into tags (id, user_id, workspace_id, name)
                values (${tagId}, ${DEMO.userId}, ${DEMO.orgId}, ${name})
                on conflict (user_id, workspace_id, name) do nothing`;
      await sql`insert into brag_tags (brag_id, tag_id) values (${b.id}, ${tagId})`;
    }
  }

  console.log("[seed:demo] ✓ demo seeded");
  console.log(`             workspace : ${DEMO.workspace} (${workspaceType})`);
  console.log(`             sign in   : ${DEMO.email} / ${DEMO.password}`);
  console.log(`             document  : "2026" — ${BRAGS.length} brags`);
} catch (err) {
  console.error("[seed:demo] failed:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}

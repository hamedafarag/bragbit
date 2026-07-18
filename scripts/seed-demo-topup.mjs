// Tops up the seeded demo (scripts/seed-demo.mjs) with a full year of wins so the
// timeline, activity heatmap, and week streak look like a logbook in real use —
// the state the marketing screenshots are captured from. The base seed stays
// deliberately minimal (5 wins); this is the "add extra wins across the year"
// step from marketing/README.md, made reproducible.
//
//   pnpm seed:demo && node scripts/seed-demo-topup.mjs
//
// Idempotent — clears its own `topup-*` rows first, so re-running resets the
// top-up. Requires the base demo (demo-user / demo-workspace / demo-doc-2026)
// to exist. Raw SQL + the `postgres` driver, like the base seed.
import "dotenv/config";

import postgres from "postgres";

const DOC = "demo-doc-2026";
const USER = "demo-user";
const ORG = "demo-workspace";

// Riley Chen, Staff Engineer on a construction-workforce IoT platform (crews,
// sites, gateways, firmware) — same world as the base seed's five wins. Dates
// span Jan–Jul 2026 and cover every recent week, so the heatmap fills in and the
// streak reads as a long run of consistent logging.
const TOPUP = [
  // January — planning the year
  {
    id: "topup-01-08",
    date: "2026-01-08",
    category: "leadership",
    status: "shipped",
    title: "Set the 2026 platform-reliability OKRs",
    description:
      "Facilitated three squads to a single error-budget policy and a shared on-call charter.",
    impact: "One reliability bar across teams instead of three competing ones",
    tags: ["planning", "reliability"],
  },
  {
    id: "topup-01-16",
    date: "2026-01-16",
    category: "technical-contribution",
    status: "shipped",
    title: "Introduced OpenTelemetry tracing across the ingest path",
    description:
      "Instrumented every hop from gateway to API so a slow request can be traced end to end.",
    impact: "p95 debugging time on ingest issues: hours → minutes",
    links: [{ url: "https://github.com/bragbit/demo/pull/1203", label: "PR #1203" }],
    tags: ["observability", "platform"],
  },
  {
    id: "topup-01-27",
    date: "2026-01-27",
    category: "glue-process-work",
    status: "shipped",
    title: "Wrote the incident-review template the org adopted",
    description:
      "Blameless format with a timeline, contributing factors, and follow-up owners — now the default for every Sev.",
    tags: ["process"],
  },

  // February
  {
    id: "topup-02-10",
    date: "2026-02-10",
    category: "shipped-work",
    status: "shipped",
    title: "Shipped offline sync for the site tablet app",
    description:
      "Queue-and-reconcile so crews keep logging through dead zones and conflicts resolve on reconnect.",
    impact: "Zero data loss across three weeks of spotty-connectivity sites",
    collaborators: ["Mobile team"],
    links: [{ url: "https://github.com/bragbit/demo/pull/1247", label: "PR #1247" }],
    tags: ["mobile", "offline"],
  },
  {
    id: "topup-02-18",
    date: "2026-02-18",
    category: "recognition-feedback",
    title: "Praise from the field-ops lead",
    description:
      '> "The offline mode just works. My crews stopped losing an hour of logs every shift."',
    attribution: "J. Alvarez, Field Operations",
  },
  {
    id: "topup-02-24",
    date: "2026-02-24",
    category: "skills-learning",
    status: "in_progress",
    title: "Learning Rust for the edge-gateway firmware",
    description:
      "Working through the ownership model on a spare gateway; rewrote the sensor parser as a first exercise.",
    tags: ["rust", "firmware"],
  },

  // March
  {
    id: "topup-03-04",
    date: "2026-03-04",
    category: "technical-contribution",
    status: "shipped",
    visibility: "private",
    title: "Halved gateway memory with a ring-buffer rewrite",
    description: "Replaced per-sample allocations with a fixed ring buffer on the hot path.",
    impact: "Fits 2× the sensors per gateway — hardware BOM per site down ~18%",
    tags: ["firmware", "performance"],
  },
  {
    id: "topup-03-12",
    date: "2026-03-12",
    category: "collaboration-mentoring",
    status: "shipped",
    title: 'Ran a company-wide "reading a flamegraph" workshop',
    description: "Live-profiled a real slow endpoint and fixed it on stage.",
    impact: "40+ engineers attended; two teams adopted continuous profiling after",
    tags: ["mentoring", "devex"],
  },
  {
    id: "topup-03-26",
    date: "2026-03-26",
    category: "shipped-work",
    status: "shipped",
    title: "Rolled out per-site feature flags",
    description:
      "Staged rollouts scoped to a single site so a bad change can't take down the fleet.",
    impact: "Canary blast radius cut from all sites to one",
    links: [{ url: "https://github.com/bragbit/demo/pull/1358", label: "PR #1358" }],
    tags: ["platform"],
  },

  // April (base seed has 04-08 mentoring)
  {
    id: "topup-04-02",
    date: "2026-04-02",
    category: "glue-process-work",
    status: "shipped",
    title: "Untangled the on-call escalation policy",
    description:
      "Collapsed four overlapping rotations into a clear primary/secondary with documented hand-offs.",
    tags: ["process", "oncall"],
  },
  {
    id: "topup-04-15",
    date: "2026-04-15",
    category: "shipped-work",
    status: "shipped",
    title: "Shipped real-time geofence breach alerts",
    description:
      "Stream-processes crew positions against exclusion zones and pages the safety team on entry.",
    impact: "Safety team notified in under 2s when a worker enters a no-go zone",
    collaborators: ["Safety team", "Data team"],
    links: [{ url: "https://github.com/bragbit/demo/pull/1394", label: "PR #1394" }],
    tags: ["realtime", "safety"],
  },
  {
    id: "topup-04-23",
    date: "2026-04-23",
    category: "technical-contribution",
    status: "shipped",
    visibility: "private",
    title: "Migrated ingest from REST polling to gRPC streams",
    description: "Long-lived streams with backpressure replaced a fleet of polling loops.",
    impact: "Ingest CPU down 45%; end-to-end latency 900ms → 180ms",
    links: [{ url: "https://github.com/bragbit/demo/pull/1411", label: "PR #1411" }],
    tags: ["platform", "performance"],
  },

  // May (base seed has 05-20 recognition)
  {
    id: "topup-05-05",
    date: "2026-05-05",
    category: "shipped-work",
    status: "shipped",
    title: "Delivered the safety-compliance export for auditors",
    description:
      "One-click, date-scoped export of incidents and attestations in the auditor's format.",
    impact: "Audit prep dropped from ~2 days of manual pulls to 20 minutes",
    tags: ["reporting"],
  },
  {
    id: "topup-05-13",
    date: "2026-05-13",
    category: "leadership",
    status: "shipped",
    title: "Led the multi-region failover game day",
    description: "Scripted a region loss and ran the whole platform team through the runbook live.",
    impact: "Found and fixed four latent failover bugs before they could hit production",
    collaborators: ["SRE"],
    tags: ["reliability"],
  },
  {
    id: "topup-05-28",
    date: "2026-05-28",
    category: "skills-learning",
    status: "shipped",
    title: "Finished the distributed-systems reading cohort",
    description:
      "Worked through the Raft and consistency papers with a small internal group over six weeks.",
    tags: ["learning"],
  },

  // June (base seed has 06-12 heatmap launch)
  {
    id: "topup-06-02",
    date: "2026-06-02",
    category: "technical-contribution",
    status: "shipped",
    title: "Built a backpressure-aware queue for sensor bursts",
    description:
      "Shift changes spike ingest 10×; the queue sheds load gracefully instead of dropping frames.",
    impact: "Absorbs 10× bursts with zero dropped positions",
    links: [{ url: "https://github.com/bragbit/demo/pull/1456", label: "PR #1456" }],
    tags: ["platform", "realtime"],
  },
  {
    id: "topup-06-05",
    date: "2026-06-05",
    category: "collaboration-mentoring",
    status: "shipped",
    title: "Got a new platform hire shipping in week one",
    description:
      "Pre-built their dev environment and paired on a real first PR against the ingest service.",
    tags: ["mentoring"],
  },
  {
    id: "topup-06-19",
    date: "2026-06-19",
    category: "shipped-work",
    status: "shipped",
    title: "Shipped the crew-utilization weekly digest",
    description:
      "A Monday email to each site manager summarizing idle time and crew movement for the prior week.",
    impact: "Opened by 82% of site managers in the first week",
    tags: ["product"],
  },
  {
    id: "topup-06-25",
    date: "2026-06-25",
    category: "glue-process-work",
    status: "shipped",
    title: "Automated the release changelog from PR labels",
    description: "Generates the changelog at tag time so it's never skipped or hand-written again.",
    impact: "~2 hours saved per release; changelogs now 100% consistent",
    links: [{ url: "https://github.com/bragbit/demo/pull/1471", label: "PR #1471" }],
    tags: ["devex", "process"],
  },
  {
    id: "topup-06-29",
    date: "2026-06-29",
    category: "recognition-feedback",
    title: "All-hands shout-out for the heatmap launch",
    description:
      '> "The real-time heatmap is the feature customers demo to their own bosses. Huge quarter, Riley."',
    attribution: "CTO, company all-hands",
  },

  // July — recent, consistent (up to mid-month)
  {
    id: "topup-07-01",
    date: "2026-07-01",
    category: "technical-contribution",
    status: "shipped",
    visibility: "private",
    title: "Cut ingest-worker cold start by 60%",
    description: "Lazy-loaded the model bundles and warmed the connection pool at boot.",
    impact: "Autoscaling reacts in 8s instead of 40s during shift changes",
    tags: ["performance"],
  },
  {
    id: "topup-07-08",
    date: "2026-07-08",
    category: "technical-contribution",
    status: "shipped",
    title: "Added idempotency keys to the whole write path",
    description:
      "Every write now carries a client-supplied key so retries can't create duplicates.",
    impact: "Duplicate-event pages to on-call dropped to zero",
    links: [{ url: "https://github.com/bragbit/demo/pull/1489", label: "PR #1489" }],
    tags: ["platform", "reliability"],
  },
  {
    id: "topup-07-11",
    date: "2026-07-11",
    category: "collaboration-mentoring",
    status: "shipped",
    title: "A mentee ran their first incident solo",
    description:
      "Handed off primary on-call and stayed hands-off; they diagnosed and resolved a gateway flap cleanly.",
    tags: ["mentoring", "oncall"],
  },
  {
    id: "topup-07-15",
    date: "2026-07-15",
    category: "skills-learning",
    status: "in_progress",
    title: "Prototyping anomaly detection on sensor streams",
    description:
      "Testing a lightweight z-score detector on live gateway data to flag failing sensors early.",
    tags: ["ml", "realtime"],
  },
  {
    id: "topup-07-17",
    date: "2026-07-17",
    category: "shipped-work",
    status: "shipped",
    title: "Shipped device-health self-diagnostics to firmware",
    description:
      "Gateways now self-report failing sensors and radio health instead of waiting for a field check.",
    impact: "Field techs pinpoint bad sensors remotely — fewer truck rolls",
    collaborators: ["Firmware team"],
    links: [{ url: "https://github.com/bragbit/demo/pull/1502", label: "PR #1502" }],
    tags: ["firmware"],
  },
];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[seed:demo:topup] DATABASE_URL is not set (copy .env.example → .env)");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

try {
  const doc = await sql`select id from documents where id = ${DOC}`;
  if (doc.length === 0) {
    console.error("[seed:demo:topup] base demo not found — run `pnpm seed:demo` first");
    process.exit(1);
  }

  // Idempotent reset of this script's own rows.
  await sql`delete from brag_tags where brag_id like 'topup-%'`;
  await sql`delete from brag_links where brag_id like 'topup-%'`;
  await sql`delete from brags where id like 'topup-%'`;

  for (const b of TOPUP) {
    await sql`insert into brags
                (id, document_id, title, description_md, impact_md, date, category, status, visibility, collaborators, attribution)
              values
                (${b.id}, ${DOC}, ${b.title}, ${b.description ?? null}, ${b.impact ?? null},
                 ${b.date}, ${b.category ?? null}, ${b.status ?? null}, ${b.visibility ?? "shared"},
                 ${b.collaborators ?? null}, ${b.attribution ?? null})`;

    for (const [i, link] of (b.links ?? []).entries()) {
      await sql`insert into brag_links (id, brag_id, url, label, position)
                values (${`${b.id}-link-${i}`}, ${b.id}, ${link.url}, ${link.label}, ${i})`;
    }

    for (const name of b.tags ?? []) {
      const tagId = `demo-tag-${name}`;
      await sql`insert into tags (id, user_id, workspace_id, name)
                values (${tagId}, ${USER}, ${ORG}, ${name})
                on conflict (user_id, workspace_id, name) do nothing`;
      await sql`insert into brag_tags (brag_id, tag_id) values (${b.id}, ${tagId})`;
    }
  }

  const [{ count }] =
    await sql`select count(*)::int as count from brags where document_id = ${DOC}`;
  console.log("[seed:demo:topup] ✓ topped up");
  console.log(`             added   : ${TOPUP.length} wins`);
  console.log(`             document: "2026" — ${count} wins total`);
} catch (err) {
  console.error("[seed:demo:topup] failed:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}

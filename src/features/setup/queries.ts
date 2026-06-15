import "server-only";

import { connection } from "next/server";

import { db } from "@/lib/db";
import { organization } from "@/lib/db/schema";

/**
 * True once at least one workspace (organization) exists. In the private modes
 * the /setup wizard is reachable only while this is false; once a workspace is
 * created the wizard is permanently closed.
 */
export async function isInstanceSetup(): Promise<boolean> {
  // Live instance state — it must reflect the database at request time, never a
  // build snapshot. connection() excludes every caller (the root page, /setup, and
  // the auth layout) from prerendering, so a production image builds with no
  // database reachable. (Next 16 removed the route-segment `dynamic` export; this
  // is the supported replacement — see the connection() API + docs/architecture.md.)
  await connection();
  const rows = await db.select({ id: organization.id }).from(organization).limit(1);
  return rows.length > 0;
}

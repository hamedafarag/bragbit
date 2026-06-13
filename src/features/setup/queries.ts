import "server-only";

import { db } from "@/lib/db";
import { organization } from "@/lib/db/schema";

/**
 * True once at least one workspace (organization) exists. In the private modes
 * the /setup wizard is reachable only while this is false; once a workspace is
 * created the wizard is permanently closed.
 */
export async function isInstanceSetup(): Promise<boolean> {
  const rows = await db.select({ id: organization.id }).from(organization).limit(1);
  return rows.length > 0;
}

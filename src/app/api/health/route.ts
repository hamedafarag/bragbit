import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";

// A health probe must reflect live state, so it must never be cached or prerendered.
export const dynamic = "force-dynamic";

/**
 * Container health check (ENH-INFRA-03). A dependency-light GET that also runs
 * `select 1`, so a 200 means the app is serving AND Postgres is reachable; a DB
 * failure answers 503. The docker-compose healthcheck targets this instead of `/`
 * (which renders the full app and varies with setup state). Unauthenticated by
 * design — it returns no instance data, only a status string.
 */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}

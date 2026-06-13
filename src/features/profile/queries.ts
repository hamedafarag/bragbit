import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { profile } from "@/lib/db/schema";

export type ProfileRow = typeof profile.$inferSelect;

/** The caller's profile row, or null if they haven't saved one yet. */
export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const [row] = await db.select().from(profile).where(eq(profile.userId, userId)).limit(1);
  return row ?? null;
}

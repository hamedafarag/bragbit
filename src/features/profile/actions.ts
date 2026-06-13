"use server";

import { eq } from "drizzle-orm";

import { requireSession } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { profile, user as userTable } from "@/lib/db/schema";

import { profileSchema, type ProfileInput } from "./schema";

export type ProfileResult = { ok: true } | { ok: false; error: string };

/**
 * Upsert the caller's profile (display name, role, team, bio). The display name
 * is mirrored to the Better Auth `user.name` so emails and other auth surfaces
 * stay consistent with the in-app identity. The client refreshes after this
 * returns. Avatars take a separate path (POST /api/upload/avatar) since they're
 * multipart, not a Server Action payload.
 */
export async function updateProfile(input: ProfileInput): Promise<ProfileResult> {
  const { user } = await requireSession();

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { displayName, roleTitle, team, bio } = parsed.data;
  const orNull = (v: string) => (v.trim() === "" ? null : v.trim());
  const fields = {
    displayName,
    roleTitle: orNull(roleTitle),
    team: orNull(team),
    bio: orNull(bio),
  };

  await db
    .insert(profile)
    .values({ userId: user.id, ...fields })
    .onConflictDoUpdate({ target: profile.userId, set: fields });

  await db.update(userTable).set({ name: displayName }).where(eq(userTable.id, user.id));

  return { ok: true };
}

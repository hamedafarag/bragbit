"use server";

import { eq } from "drizzle-orm";

import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { organization } from "@/lib/db/schema";

import { brandingSchema, type BrandingInput } from "./schema";

export type BrandingResult = { ok: true } | { ok: false; error: string };

/**
 * Update the active workspace's branding (name + accent). Owner/admin only — the
 * role gate runs in the DAL. The logo is set by its own upload route. The client
 * refreshes after this returns so the chrome re-renders with the new brand.
 */
export async function updateWorkspaceBranding(input: BrandingInput): Promise<BrandingResult> {
  const { workspaceId } = await requireRole("owner", "admin");

  const parsed = brandingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await db
    .update(organization)
    .set({ name: parsed.data.name, accentColor: parsed.data.accentColor })
    .where(eq(organization.id, workspaceId));

  return { ok: true };
}

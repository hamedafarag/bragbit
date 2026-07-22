"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { hitRateLimit, resetRateLimit } from "@/lib/rate-limit";

import { getPendingInvitation } from "./queries";
import { acceptInviteSchema, type AcceptInviteInput } from "./schema";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Step 1 — register the invitee BOUND to the invited email (never trust a
 * client-supplied email), mark them verified (the tokenized invite link is the
 * proof of email ownership), and sign them in so nextCookies() sets the session
 * cookie. The actual accept runs in a separate request (see acceptInvitation)
 * because the cookie set here is not visible in this action's headers().
 */
export async function registerInvitee(
  invitationId: string,
  input: AcceptInviteInput,
): Promise<ActionResult> {
  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Bound repeated attempts against a single invitation link. The lookup below
  // runs before any Better Auth endpoint is hit (an invalid id never reaches the
  // per-IP sign-up limit), so the in-house limiter guards this entry directly.
  const limit = hitRateLimit(`invite-register:${invitationId}`, 8, 10 * 60 * 1000);
  if (!limit.ok) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const invite = await getPendingInvitation(invitationId);
  if (!invite) {
    return { ok: false, error: "This invitation is invalid or has expired." };
  }

  try {
    await auth.api.signUpEmail({
      body: { name: parsed.data.name, email: invite.email, password: parsed.data.password },
      headers: await headers(),
    });
    await db
      .update(userTable)
      .set({ emailVerified: true })
      .where(eq(userTable.email, invite.email));
    await auth.api.signInEmail({
      body: { email: invite.email, password: parsed.data.password },
      headers: await headers(),
    });
    resetRateLimit(`invite-register:${invitationId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not create your account.",
    };
  }
}

/**
 * Step 2 — accept the invitation. Runs as a separate request, so the session
 * cookie set by registerInvitee is present in headers() here. Better Auth
 * checks the session email matches the invitation, flips status to accepted,
 * creates the member, and sets the active organization. On success it redirects
 * to /dashboard server-side, so the navigation can't be raced by a client-side
 * push against this route's post-accept revalidation; it only returns to the
 * caller when the accept fails.
 */
export async function acceptInvitation(invitationId: string): Promise<ActionResult | void> {
  try {
    await auth.api.acceptInvitation({
      body: { invitationId },
      headers: await headers(),
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not accept the invitation.",
    };
  }
  // Redirect OUTSIDE the try/catch — redirect() signals by throwing, so catching
  // it would swallow the navigation.
  redirect("/dashboard");
}

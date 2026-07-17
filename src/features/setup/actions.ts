"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { session as sessionTable, user as userTable } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { isPrivateSolo } from "@/lib/instance";

import { isInstanceSetup } from "./queries";
import { setupSchema, type SetupInput } from "./schema";

export type SetupResult = { ok: true } | { ok: false; error: string };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * First-run wizard action. Creates the owner account and the first workspace,
 * then signs the owner in. Ordering is load-bearing (Better Auth): sign-up
 * creates no session under required verification, so we flip emailVerified, sign
 * in (nextCookies sets the cookie), then create the organization via the
 * server-only userId path and set it active by session row.
 */
export async function completeSetup(input: SetupInput): Promise<SetupResult> {
  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  if (env.SETUP_TOKEN && data.setupToken !== env.SETUP_TOKEN) {
    return { ok: false, error: "Invalid setup token." };
  }

  if (await isInstanceSetup()) {
    return { ok: false, error: "This instance has already been set up." };
  }

  const workspaceType = isPrivateSolo() ? "personal" : "organization";

  try {
    // 1) Create the owner. With required verification this returns no session.
    const { user: owner } = await auth.api.signUpEmail({
      body: { name: data.name, email: data.email, password: data.password },
      headers: await headers(),
    });

    // 2) The setup operator is trusted — mark verified so sign-in passes.
    await db.update(userTable).set({ emailVerified: true }).where(eq(userTable.id, owner.id));

    // 3) Sign in — the nextCookies() after-hook writes the session cookie.
    const signedIn = await auth.api.signInEmail({
      body: { email: data.email, password: data.password },
      headers: await headers(),
    });

    // 4) Create the workspace via the server-only userId path (no headers: the
    //    cookie set in step 3 isn't in this request's headers() snapshot).
    const org = await auth.api.createOrganization({
      body: {
        name: data.workspaceName,
        slug: slugify(data.workspaceName) || "workspace",
        userId: owner.id,
        type: workspaceType,
        ...(data.accentColor ? { accentColor: data.accentColor } : {}),
      },
    });

    // 5) The userId path doesn't auto-set the active org — set it on the session.
    if (org?.id) {
      await db
        .update(sessionTable)
        .set({ activeOrganizationId: org.id })
        .where(eq(sessionTable.token, signedIn.token));
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Setup failed. Please try again.",
    };
  }
}

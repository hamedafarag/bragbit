import "server-only";

import { env } from "@/lib/env";

/**
 * Parse the SUPERADMIN_EMAILS allowlist (comma/space-separated) into a lowercased
 * Set. Pure — kept separate from the env binding so it's unit-testable.
 */
export function parseSuperadminEmails(raw: string | null | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(/[,\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

const ALLOWLIST = parseSuperadminEmails(env.SUPERADMIN_EMAILS);

/**
 * Whether `email` is an instance superadmin (the hosted ops console at /super). The
 * allowlist comes from SUPERADMIN_EMAILS; an empty allowlist means no superadmin, so
 * /super stays closed until one is configured.
 */
export function isSuperadmin(email: string | null | undefined): boolean {
  return email != null && ALLOWLIST.has(email.toLowerCase());
}

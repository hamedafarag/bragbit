import "server-only";

import type { EmailBrand } from "@/emails/components/email-layout";

import { db } from "./db";
import { organization } from "./db/schema";
import { env } from "./env";
import { isHosted } from "./instance";

type BrandFields = { name: string; accentColor?: string | null; logoKey?: string | null };

/**
 * Build an EmailBrand (name + accent + absolute logo URL) from a workspace's
 * branding fields. Logos are served by a public route, so the absolute URL works
 * in an email client. Kept free of the DAL guards so `lib/auth` can use it
 * without an import cycle.
 */
export function emailBrandFromOrg(o: BrandFields): EmailBrand {
  const base = env.BETTER_AUTH_URL ?? env.APP_URL;
  return {
    name: o.name,
    accent: o.accentColor ?? undefined,
    logoUrl: o.logoKey ? `${base}/api/files/${o.logoKey}` : undefined,
  };
}

/**
 * Brand for the instance-default email surfaces (verification, password reset,
 * email-change confirmation), which carry no workspace context of their own. The
 * private modes have exactly one workspace, so its brand applies; hosted has many,
 * so fall back to the BragBit default.
 */
export async function instanceEmailBrand(): Promise<EmailBrand | undefined> {
  if (isHosted()) return undefined;
  const [o] = await db
    .select({
      name: organization.name,
      accentColor: organization.accentColor,
      logoKey: organization.logoKey,
    })
    .from(organization)
    .limit(1);
  return o ? emailBrandFromOrg(o) : undefined;
}

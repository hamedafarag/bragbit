import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins/organization";
import { asc, eq } from "drizzle-orm";

import { ChangeEmailConfirmation } from "@/emails/change-email";
import { InvitationEmail } from "@/emails/invitation";
import { ResetPasswordEmail } from "@/emails/reset-password";
import { VerifyEmail } from "@/emails/verify-email";
import { cleanupUserStorage } from "@/features/account/deletion";
import { emailBrandFromOrg, instanceEmailBrand } from "@/lib/branding";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { member } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/send";
import { env } from "@/lib/env";
import { isHosted } from "@/lib/instance";

// Social providers, configured only when both an id and secret are present.
const githubConfigured = Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
const googleConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL ?? env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),

  // Brute-force protection for the auth endpoints. Better Auth's limiter ships
  // strict built-in rules for the sensitive paths — 3 requests / 10s on
  // /sign-in, /sign-up, /change-password, /change-email, and 3 / 60s on
  // password-reset + verification-email — backed by an in-memory store. We enable
  // it explicitly (it's production-only by default; left off in dev/test so local
  // flows and the e2e suite aren't throttled). A shared store (secondaryStorage)
  // is the multi-instance upgrade for the hosted mode (Phase 10).
  rateLimit: {
    enabled: env.RATE_LIMIT_ENABLED ?? env.NODE_ENV === "production",
  },

  databaseHooks: {
    session: {
      create: {
        // Resolve the active workspace on every session creation: pick the
        // caller's earliest membership and pin it as the session's active
        // organization. Without this, a plain email/password sign-in leaves
        // activeOrganizationId null and requireWorkspace() bounces to "/"
        // (only setup/accept-invite set it explicitly). In private-solo the
        // user has exactly one membership; multi-workspace selection (hosted)
        // refines this later. During setup/invite the membership doesn't exist
        // yet at session-create time, so this no-ops and those flows set it.
        before: async (session) => {
          const [m] = await db
            .select({ organizationId: member.organizationId })
            .from(member)
            .where(eq(member.userId, session.userId))
            .orderBy(asc(member.createdAt))
            .limit(1);
          if (!m) return;
          return { data: { ...session, activeOrganizationId: m.organizationId } };
        },
      },
    },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: env.AUTH_TOKEN_TTL_MINUTES * 60,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your BragBit password",
        template: ResetPasswordEmail({ url, brand: await instanceEmailBrand() }),
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: env.AUTH_TOKEN_TTL_MINUTES * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email",
        template: VerifyEmail({ url, brand: await instanceEmailBrand() }),
      });
    },
  },

  user: {
    changeEmail: {
      enabled: true,
      // Email is verified (required), so Better Auth sends the confirmation to
      // the CURRENT address; the change only applies once the user clicks it.
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Confirm your new BragBit email",
          template: ChangeEmailConfirmation({ url, newEmail, brand: await instanceEmailBrand() }),
        });
      },
    },
    deleteUser: {
      enabled: true,
      // The user table cascades to its sessions, accounts, members and profile.
      // What it does NOT cascade is the workspace, the avatar file, or the
      // attachments' stored objects — so clean those up first (drop sole-member
      // workspaces and purge orphaned storage objects). See cleanupUserStorage.
      beforeDelete: async (deletingUser) => {
        await cleanupUserStorage(deletingUser.id);
      },
    },
  },

  // Optional GitHub/Google sign-in (PLAN.md §4/§6). In the private modes OAuth
  // only signs in already-provisioned accounts — `disableSignUp` blocks creating
  // a new user from an unrecognized OAuth identity, which would otherwise defeat
  // invitation-only. Hosted may create an account (its personal-workspace
  // provisioning lands in Phase 10).
  socialProviders: {
    ...(githubConfigured
      ? {
          github: {
            clientId: env.GITHUB_CLIENT_ID!,
            clientSecret: env.GITHUB_CLIENT_SECRET!,
            disableSignUp: !isHosted(),
          },
        }
      : {}),
    ...(googleConfigured
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID!,
            clientSecret: env.GOOGLE_CLIENT_SECRET!,
            disableSignUp: !isHosted(),
          },
        }
      : {}),
  },

  account: {
    accountLinking: {
      // Let an existing (email-verified) account attach a GitHub/Google identity
      // by matching email, so OAuth works as a sign-in method for invited users.
      enabled: true,
      trustedProviders: ["github", "google"],
    },
  },

  plugins: [
    organization({
      // workspace = Better Auth organization, with a `type` discriminator.
      invitationExpiresIn: env.INVITATION_TTL_DAYS * 60 * 60 * 24, // default 7 days (PLAN)
      // Re-inviting an address revokes its prior pending invite (PLAN §6).
      cancelPendingInvitationsOnReInvite: true,
      schema: {
        organization: {
          additionalFields: {
            type: { type: "string", required: true, defaultValue: "organization", input: true },
            accentColor: { type: "string", required: false, input: true },
            logoKey: { type: "string", required: false, input: true },
          },
        },
      },
      sendInvitationEmail: async (data) => {
        const base = env.BETTER_AUTH_URL ?? env.APP_URL;
        await sendEmail({
          to: data.email,
          subject: `You're invited to ${data.organization.name} on BragBit`,
          template: InvitationEmail({
            organizationName: data.organization.name,
            inviterName: data.inviter.user.name,
            acceptUrl: `${base}/accept-invitation/${data.id}`,
            brand: emailBrandFromOrg(data.organization),
          }),
        });
      },
    }),
    // nextCookies() MUST be last — it writes Set-Cookie via an after-hook.
    nextCookies(),
  ],
});

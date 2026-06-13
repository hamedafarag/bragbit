import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins/organization";
import { and, asc, eq, ne } from "drizzle-orm";

import { ChangeEmailConfirmation } from "@/emails/change-email";
import { InvitationEmail } from "@/emails/invitation";
import { ResetPasswordEmail } from "@/emails/reset-password";
import { VerifyEmail } from "@/emails/verify-email";
import { emailBrandFromOrg, instanceEmailBrand } from "@/lib/branding";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { member, organization as organizationTable, profile } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/send";
import { env } from "@/lib/env";
import { isHosted } from "@/lib/instance";
import { getStorage } from "@/lib/storage";

// Social providers, configured only when both an id and secret are present.
const githubConfigured = Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
const googleConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL ?? env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),

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
      // What it does NOT cascade is the workspace itself or the avatar file, so
      // clean those up first: drop any workspace the user is the sole member of
      // (always true for a personal workspace; also reaps an org they were the
      // last member of), and delete their avatar object from storage.
      beforeDelete: async (deletingUser) => {
        const [p] = await db
          .select({ avatarKey: profile.avatarKey })
          .from(profile)
          .where(eq(profile.userId, deletingUser.id))
          .limit(1);
        if (p?.avatarKey)
          await getStorage()
            .delete(p.avatarKey)
            .catch(() => {});

        const memberships = await db
          .select({ organizationId: member.organizationId })
          .from(member)
          .where(eq(member.userId, deletingUser.id));
        for (const { organizationId } of memberships) {
          const [other] = await db
            .select({ id: member.id })
            .from(member)
            .where(
              and(eq(member.organizationId, organizationId), ne(member.userId, deletingUser.id)),
            )
            .limit(1);
          if (!other) {
            await db.delete(organizationTable).where(eq(organizationTable.id, organizationId));
          }
        }
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
      invitationExpiresIn: 60 * 60 * 24 * 7, // 7 days (PLAN)
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

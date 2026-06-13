import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins/organization";

import { InvitationEmail } from "@/emails/invitation";
import { ResetPasswordEmail } from "@/emails/reset-password";
import { VerifyEmail } from "@/emails/verify-email";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/send";
import { env } from "@/lib/env";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL ?? env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your BragBit password",
        template: ResetPasswordEmail({ url }),
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
        template: VerifyEmail({ url }),
      });
    },
  },

  plugins: [
    organization({
      // workspace = Better Auth organization, with a `type` discriminator.
      invitationExpiresIn: 60 * 60 * 24 * 7, // 7 days (PLAN)
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
          }),
        });
      },
    }),
    // nextCookies() MUST be last — it writes Set-Cookie via an after-hook.
    nextCookies(),
  ],
});

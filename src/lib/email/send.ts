import "server-only";

import { render } from "@react-email/render";
import type { ReactElement } from "react";

import { env } from "@/lib/env";
import { getTransport } from "./client";

/**
 * Render a React Email template to HTML + plain text and send it over SMTP.
 * Every BragBit email (verification, invitation, reset, reminders) goes through
 * here so branding and delivery stay consistent.
 */
export async function sendEmail({
  to,
  subject,
  template,
}: {
  to: string | string[];
  subject: string;
  template: ReactElement;
}): Promise<void> {
  const [html, text] = await Promise.all([render(template), render(template, { plainText: true })]);

  await getTransport().sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    html,
    text,
  });
}

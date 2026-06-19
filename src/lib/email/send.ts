import "server-only";

import { render } from "@react-email/render";
import type { ReactElement } from "react";

import { env } from "@/lib/env";
import { getTransport } from "./client";

/** A file to attach to an email (a subset of Nodemailer's attachment shape). */
export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

/**
 * Render a React Email template to HTML + plain text and send it over SMTP.
 * Every BragBit email (verification, invitation, reset, reminders) goes through
 * here so branding and delivery stay consistent. `attachments` pass through to
 * Nodemailer for the few mails that carry files (e.g. the member-removal bundle).
 */
export async function sendEmail({
  to,
  subject,
  template,
  attachments,
}: {
  to: string | string[];
  subject: string;
  template: ReactElement;
  attachments?: EmailAttachment[];
}): Promise<void> {
  const [html, text] = await Promise.all([render(template), render(template, { plainText: true })]);

  await getTransport().sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    html,
    text,
    attachments,
  });
}

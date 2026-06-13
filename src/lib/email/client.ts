import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import { env } from "@/lib/env";

// A single reused transport. SMTP config comes from env (in dev it points at
// Mailpit on :1025; see docker-compose.dev.yml / .env.example).
let transport: Transporter | undefined;

export function getTransport(): Transporter {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
  }
  return transport;
}

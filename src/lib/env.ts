import { z } from "zod";

import { INSTANCE_MODES } from "./instance-modes";

/**
 * Validated, typed access to `process.env`. Imported on the server only; a
 * misconfigured environment fails fast at boot with a readable error.
 *
 * The canonical list of variables (with defaults) lives in `.env.example`.
 */

// Env flags are strings, and `z.coerce.boolean()` treats every non-empty string
// as `true` ("false" → true!), so booleans are parsed explicitly here.
const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v == null || v === "" ? def : /^(1|true|yes|on)$/i.test(v)));

const schema = z.object({
  // Instance shape
  INSTANCE_MODE: z.enum(INSTANCE_MODES).default("private-solo"),
  SETUP_TOKEN: z.string().optional(),

  // Core
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Auth (Better Auth)
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  BETTER_AUTH_URL: z.string().optional(),

  // Email (SMTP)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: bool(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default("BragBit <no-reply@bragbit.local>"),

  // Storage adapter
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_DIR: z.string().default("./.data/uploads"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: bool(true),

  // OAuth (optional)
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Uploads
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(25),

  // Hosted-mode abuse controls
  BLOCK_DISPOSABLE_EMAIL: bool(true),
  WORKSPACE_QUOTA_MB: z.coerce.number().int().positive().default(2048),

  // Reminder cron (external-cron fallback)
  CRON_SECRET: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
export type Env = typeof env;

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
  BETTER_AUTH_SECRET: z
    .string()
    .min(
      32,
      "BETTER_AUTH_SECRET must be at least 32 characters (generate with `openssl rand -base64 32`)",
    ),
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

  // OAuth (optional) — social sign-in
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Source integrations (optional) — docs/specs/integrations.md. Each provider's
  // OAuth app is separate from social sign-in (different scopes, least privilege).
  // When a provider's id + secret are both set, its "Connect" button appears; the
  // token-paste path (GitHub PAT, Linear API key) is always available and needs none
  // of these. INTEGRATIONS_TOKEN_KEY (shared across providers) is the secret for
  // encrypting stored provider tokens at rest — optional; when unset the key is
  // derived from BETTER_AUTH_SECRET (a dedicated value lets you rotate it separately).
  GITHUB_IMPORT_CLIENT_ID: z.string().optional(),
  GITHUB_IMPORT_CLIENT_SECRET: z.string().optional(),
  LINEAR_IMPORT_CLIENT_ID: z.string().optional(),
  LINEAR_IMPORT_CLIENT_SECRET: z.string().optional(),
  INTEGRATIONS_TOKEN_KEY: z.string().optional(),

  // Uploads
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(25),

  // Reminder cron (external-cron fallback)
  CRON_SECRET: z.string().optional(),

  // Timing & limits — tunable so the time-bound flows can be exercised without
  // waiting out the production defaults (e.g. a short INVITATION_TTL_DAYS to test
  // expiry). All optional; the defaults match the shipped behaviour.
  INVITATION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  AUTH_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(60), // verify + reset links
  REMINDER_HOUR: z.coerce.number().int().min(0).max(23).default(9), // local hour reminders fire
  REMINDER_DEDUP_HOURS: z.coerce.number().positive().default(20), // re-send suppression window
  // Brute-force limiter. Unset → on in production, off in dev/test (so local flows
  // and e2e aren't throttled); set true/false to force it on either side.
  RATE_LIMIT_ENABLED: z
    .string()
    .optional()
    .transform((v) => (v == null || v === "" ? undefined : /^(1|true|yes|on)$/i.test(v))),

  // Header carrying the real client IP for per-IP auth rate-limiting. Better Auth
  // reads `x-forwarded-for` by default (correct behind the reference reverse proxy);
  // set this only if your proxy uses a different header (e.g. Cloudflare's
  // `cf-connecting-ip`, or `x-real-ip`). Trustworthy only when a proxy sets it.
  TRUSTED_PROXY_IP_HEADER: z.string().optional(),
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

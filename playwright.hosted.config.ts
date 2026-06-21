import { defineConfig, devices } from "@playwright/test";

// Dedicated config for the hosted-mode e2e (PLAN §10). Like the setup-wizard config,
// it runs its OWN `next dev` on a separate port against an isolated DB — here with
// INSTANCE_MODE=hosted so open signup is live. globalSetup creates + migrates +
// truncates that DB. Invoked via `pnpm test:e2e:hosted`; sequential so only one
// `next dev` is live at a time (Next 16 shares one `.next`).
const port = Number(process.env.HOSTED_PORT ?? 3102);
const hostedDbUrl =
  process.env.HOSTED_DATABASE_URL ?? "postgres://bragbit:bragbit@localhost:5433/bragbit_e2e_hosted";

export default defineConfig({
  testDir: "./tests/e2e-hosted",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  globalSetup: "./tests/e2e-hosted/global-setup.ts",
  use: { baseURL: `http://localhost:${port}`, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec next dev -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Point this instance at the isolated DB in HOSTED mode. Spread process.env so
    // the dev server keeps PATH/HOME/etc.; the overrides win over the .env file.
    env: {
      ...process.env,
      DATABASE_URL: hostedDbUrl,
      INSTANCE_MODE: "hosted",
      APP_URL: `http://localhost:${port}`,
      SUPERADMIN_EMAILS: "superadmin-e2e@bragbit.local",
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "0123456789abcdef0123456789abcdef",
      SMTP_HOST: process.env.SMTP_HOST ?? "localhost",
      SMTP_PORT: process.env.SMTP_PORT ?? "1025",
      SMTP_FROM: process.env.SMTP_FROM ?? "BragBit <no-reply@bragbit.local>",
    },
  },
});

import { defineConfig, devices } from "@playwright/test";

// Dedicated config for the first-run setup-wizard e2e. It runs its OWN `next dev`
// on a separate port against an isolated empty DB (see tests/e2e-setup), so it
// can exercise `/setup` (only reachable with no workspace) without disturbing the
// seeded main e2e harness. Invoked once per private mode via `test:e2e:setup`
// (INSTANCE_MODE + SETUP_PORT differ per run); the runs are sequential so only
// one `next dev` is ever live at a time (Next 16 shares one `.next`).
const port = Number(process.env.SETUP_PORT ?? 3100);
const setupDbUrl =
  process.env.SETUP_DATABASE_URL ?? "postgres://bragbit:bragbit@localhost:5433/bragbit_e2e_setup";

export default defineConfig({
  testDir: "./tests/e2e-setup",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: { baseURL: `http://localhost:${port}`, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec next dev -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Point this instance at the isolated DB + chosen mode. Spread process.env so
    // the dev server keeps PATH/HOME/etc.; the overrides win over the .env file
    // (Next doesn't override already-set process.env vars).
    env: {
      ...process.env,
      DATABASE_URL: setupDbUrl,
      INSTANCE_MODE: process.env.INSTANCE_MODE ?? "private-solo",
      APP_URL: `http://localhost:${port}`,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "0123456789abcdef0123456789abcdef",
      SMTP_HOST: process.env.SMTP_HOST ?? "localhost",
      SMTP_PORT: process.env.SMTP_PORT ?? "1025",
      SMTP_FROM: process.env.SMTP_FROM ?? "BragBit <no-reply@bragbit.local>",
    },
  },
});

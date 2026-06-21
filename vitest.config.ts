import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      // `server-only` throws when imported outside an RSC build; stub it so
      // server modules (storage, DAL queries) are unit-testable under Node.
      {
        find: "server-only",
        replacement: fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
      },
      // Mirror tsconfig's `@/*` path alias so tests can import app modules the
      // same way the app does (used by the DB-gated integration tests).
      { find: /^@\//, replacement: fileURLToPath(new URL("./src/", import.meta.url)) },
    ],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      // `include` counts every matching file in Vitest 4 (untested → 0%), so the
      // number can't be inflated by only measuring files that have a test nearby.
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
        "src/test/**", // the server-only stub + future test helpers
        "src/lib/db/schema/**", // declarative Drizzle table defs (no logic)
        "src/lib/db/migrations/**",
        "src/**/schema.ts", // declarative Zod schemas (exercised indirectly)
        "src/app/**/layout.tsx",
        "src/app/**/loading.tsx",
      ],
      // Ratchet locked to the latest `pnpm test:db:coverage` run (which un-skips
      // the DB-gated suites). Coverage must never regress past these; when a
      // change RAISES a number, bump the floor in the same PR. The global floor
      // climbs as components gain jsdom render tests (`// @vitest-environment
      // jsdom`); the logic dirs (`*.ts`, unaffected by `.tsx` tests) hold a
      // higher floor.
      thresholds: {
        statements: 34,
        branches: 25,
        functions: 35,
        lines: 34,
        "src/lib/**/*.ts": { statements: 38, branches: 27, functions: 36, lines: 42 },
        "src/features/**/*.ts": { statements: 68, branches: 62, functions: 65, lines: 69 },
      },
    },
  },
});

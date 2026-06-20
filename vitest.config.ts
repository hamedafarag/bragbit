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
      // Ratchet locked to the 2026-06-20 baseline (measured via `pnpm
      // test:db:coverage`, which un-skips the DB-gated suites). Coverage must
      // never regress past these; when a change RAISES a number, bump the floor
      // in the same PR. The global floor is low because components are still 0%
      // — it climbs as Layer 2/3 add tests. The logic dirs hold a higher floor.
      thresholds: {
        statements: 13,
        branches: 9,
        functions: 13,
        lines: 13,
        "src/lib/**/*.ts": { statements: 32, branches: 21, functions: 30, lines: 37 },
        "src/features/**/*.ts": { statements: 33, branches: 32, functions: 33, lines: 32 },
      },
    },
  },
});

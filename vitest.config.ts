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
  },
});

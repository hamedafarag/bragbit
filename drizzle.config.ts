import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// drizzle-kit is a standalone CLI, so it reads DATABASE_URL from .env directly
// (via dotenv) rather than through src/lib/env.ts.
export default defineConfig({
  schema: "./src/lib/db/schema/index.ts",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  casing: "snake_case",
  strict: true,
  verbose: true,
});

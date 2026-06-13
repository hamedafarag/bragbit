import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";
import * as schema from "./schema";

// Reuse a single client across hot reloads in dev so we don't exhaust Postgres
// connections. `casing: "snake_case"` lets table files use camelCase property
// names that map to snake_case columns.
const globalForDb = globalThis as unknown as {
  __bragbitClient?: ReturnType<typeof postgres>;
};

const client = globalForDb.__bragbitClient ?? postgres(env.DATABASE_URL);

if (env.NODE_ENV !== "production") {
  globalForDb.__bragbitClient = client;
}

export const db = drizzle(client, { schema, casing: "snake_case" });

export type DB = typeof db;

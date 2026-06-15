import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server at `.next/standalone` (a minimal `server.js` plus
  // only the traced files/node_modules) for the Docker-first / Dokploy deploy.
  output: "standalone",

  // `scripts/migrate.mjs` runs the Drizzle migrator on container start. It's a
  // plain Node script, not part of the app graph, so the standalone trace doesn't
  // bundle its deps — and Next inlines `postgres` into the server chunks rather
  // than leaving it resolvable in node_modules. Force both packages into the image
  // so the migrate step can `import` them in the slim runner.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/drizzle-orm/**/*", "./node_modules/postgres/**/*"],
  },
};

export default nextConfig;

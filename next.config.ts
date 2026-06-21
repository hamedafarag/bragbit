import type { NextConfig } from "next";

// Sent on every response. A conservative, app-wide hardening baseline; the
// reverse proxy in front of a self-host can add or override as needed.
const securityHeaders = [
  // Don't let browsers MIME-sniff a response away from its declared type — matters
  // for the user-uploaded files streamed through /api/files.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Clickjacking protection (legacy header; the CSP frame-ancestors below is the
  // modern equivalent — both, for old + new browsers).
  { key: "X-Frame-Options", value: "DENY" },
  // Keep full URLs (which can carry a share token in the path) from leaking to
  // other origins via Referer — origin-only cross-origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Drop ambient access to device APIs the app never uses.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // HTTPS-only once seen over TLS; ignored on plain HTTP, so safe to always send.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // The Content-Security-Policy is emitted per-request by `src/proxy.ts` (ENH-SEC-01) —
  // it carries a fresh `script-src` nonce each render, so it can't be a static header.
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  // Emit a self-contained server at `.next/standalone` (a minimal `server.js` plus
  // only the traced files/node_modules) for the Docker-first / Dokploy deploy.
  output: "standalone",

  // Force a few packages into the standalone trace:
  //   - drizzle-orm / postgres: `scripts/migrate.mjs` (the on-start migrator) is a
  //     plain Node script outside the app graph, and Next inlines `postgres` into
  //     the server chunks, so neither is left resolvable in node_modules otherwise.
  //   - @img: the thumbnail route imports sharp, which loads its native libvips via
  //     a computed `require('@img/sharp-' + platform)` the tracer can't follow.
  //     `.npmrc` flattens node_modules so @img sits at ./node_modules/@img; this
  //     glob force-includes it (sharp + its static deps are traced normally).
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/drizzle-orm/**/*",
      "./node_modules/postgres/**/*",
      "./node_modules/@img/**/*",
    ],
  },
};

export default nextConfig;

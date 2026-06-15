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
  // Lock down the framing / base-tag / plugin vectors. No script-src policy yet —
  // Next's inline hydration would need per-request nonces (a later hardening step).
  {
    key: "Content-Security-Policy",
    value: "base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

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

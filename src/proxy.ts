import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Build the Content-Security-Policy (ENH-SEC-01). Script execution is locked to a
 * per-request `nonce` plus `'strict-dynamic'`, so an injected inline or same-origin
 * `<script>` can't run — the XSS gap the old policy left open. The framing / base-tag
 * / plugin baseline lives here too, so the CSP has one source of truth (it used to be
 * a static header in `next.config.ts`). Other resource types (style, img, font,
 * connect) are intentionally left unrestricted — this hardening is scoped to scripts.
 * `'unsafe-eval'` is allowed only in dev, where React uses `eval` for debugging.
 */
export function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
  ].join("; ");
}

/**
 * Per-request CSP nonce (Next 16 renamed Middleware → Proxy). A fresh nonce is minted
 * for every matched request and surfaced two ways: on the response `Content-Security-
 * Policy` (what the browser enforces) and on an `x-nonce` request header, from which
 * Next extracts it and applies it to its own framework/inline scripts during the
 * (dynamic) render. The root layout opts the tree into dynamic rendering so the nonce
 * is always available.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Every document route, but not API routes, static assets, the image optimizer,
    // the favicon, or prefetches (no script executes in those, so no nonce is needed).
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

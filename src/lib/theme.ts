// Light/dark theme plumbing (ENH-UX-01). Theme is a class on <html> (`dark` or
// none) driven by CSS-variable overrides in globals.css. A cookie persists the
// choice so the server renders the right class with no flash for returning users;
// `ThemeInit` applies the OS preference on a first visit (client-side — an inline
// pre-paint script can't carry the per-request CSP nonce cleanly under React 19).

export const THEME_COOKIE = "theme";

/** Matches a `theme=dark|light` cookie; group 1 is the value (used client-side). */
export const THEME_COOKIE_RE = /(?:^|;\s*)theme=(dark|light)/;

/**
 * The <html> class for the stored theme cookie. Anything but "dark" → no class
 * (light, or — when the cookie is absent — "let ThemeInit decide"). Pure, so it's
 * unit-testable apart from `next/headers`.
 */
export function themeClass(cookieValue: string | undefined): "dark" | "" {
  return cookieValue === "dark" ? "dark" : "";
}

/**
 * The resolved theme for the client: the cookie wins; absent that, the OS
 * preference. Pure (inputs injected) so the toggle and ThemeInit agree on the
 * icon/class without depending on each other's effect order.
 */
export function resolveTheme(cookie: string, systemDark: boolean): "dark" | "light" {
  const m = THEME_COOKIE_RE.exec(cookie);
  if (m) return m[1] as "dark" | "light";
  return systemDark ? "dark" : "light";
}

"use client";

import { useEffect } from "react";

import { THEME_COOKIE_RE } from "@/lib/theme";

/**
 * Applies the OS color-scheme preference on a first visit (ENH-UX-01) — when no
 * theme cookie has been set yet. Returning users are already themed by the
 * server-rendered <html> class (no flash); this only covers the first visit, so a
 * system-dark first-timer may see a brief light flash before this runs. Renders
 * nothing; lives in the root layout so it covers every page (app, auth, share).
 */
export function ThemeInit() {
  useEffect(() => {
    if (
      !THEME_COOKIE_RE.test(document.cookie) &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      document.documentElement.classList.add("dark");
    }
  }, []);
  return null;
}

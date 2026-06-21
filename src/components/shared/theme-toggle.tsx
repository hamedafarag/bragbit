"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { THEME_COOKIE, resolveTheme } from "@/lib/theme";

/**
 * Light/dark toggle (ENH-UX-01). Flips the `.dark` class on <html> and persists a
 * cookie the server reads for no-flash SSR on the next load. The resolved theme is
 * client-only (cookie / OS preference), so the icon stays `null` until mounted to
 * avoid a hydration mismatch.
 */
export function ThemeToggle() {
  const [resolved, setResolved] = useState<"dark" | "light" | null>(null);

  useEffect(() => {
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading client-only state (cookie/OS) once on mount is the intended pattern; one harmless post-mount render.
    setResolved(resolveTheme(document.cookie, systemDark));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    document.cookie = `${THEME_COOKIE}=${next ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
    setResolved(next ? "dark" : "light");
  }

  const isDark = resolved === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="grid size-8 place-items-center rounded-md text-ink-soft transition-colors hover:bg-accent hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

import type { CSSProperties } from "react";

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** WCAG relative luminance of a `#rrggbb` color (0 = black, 1 = white). */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/**
 * Inline style overriding the accent CSS variables for a per-workspace brand.
 * Returns undefined for a missing/invalid hex so the default palette stands.
 * `--primary-foreground` is set to whichever of white / ink contrasts better with
 * the chosen accent, so a light accent never leaves the button text unreadable
 * (WCAG; ENH-UX-02).
 *
 * Element-scoped: use this only where the accent really is confined to a subtree
 * (e.g. the branding form's live preview swatch). For a page's own brand use
 * `accentCss` / `<AccentStyle>` — an inline style stops at the portal boundary,
 * and dialogs/toasts render outside the tree entirely.
 */
export function accentVars(hex?: string | null): CSSProperties | undefined {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return undefined;
  const L = luminance(hex);
  const onWhite = 1.05 / (L + 0.05); // contrast of white text on the accent
  const onInk = (L + 0.05) / (luminance("#221d16") + 0.05); // ink text on the accent
  const foreground = onWhite >= onInk ? "#ffffff" : "#221d16";
  return { "--primary": hex, "--ring": hex, "--primary-foreground": foreground } as CSSProperties;
}

/**
 * The same accent variables as a `:root` rule, for a page-level brand.
 *
 * Why `:root` rather than an inline style on a layout wrapper: Radix portals
 * dialog content into `document.body`, and the sonner `Toaster` is mounted in the
 * root layout — both outside any wrapper a page or layout can reach. A wrapper's
 * variables therefore stopped at the portal boundary and every dialog, plus every
 * toast action button, silently fell back to the default palette. `:root` is
 * inherited by `body`, so portalled content is branded too.
 *
 * Returns undefined for a missing/invalid hex (same contract as `accentVars`).
 * The output is safe to inject: the hex is regex-validated above and the
 * foreground is one of two literals, so no caller-controlled text reaches the CSS.
 */
export function accentCss(hex?: string | null): string | undefined {
  const vars = accentVars(hex);
  if (!vars) return undefined;
  const decls = Object.entries(vars)
    .map(([prop, value]) => `${prop}:${value}`)
    .join(";");
  return `:root{${decls}}`;
}

/**
 * Append a thumbnail-width hint to an `/api/files` URL (ENH-PERF-02). The route
 * serves a downscaled webp for allowlisted widths and ignores anything else, so
 * this is a safe no-op for an unknown width. Handles a pre-existing query (e.g. a
 * share `?token=`).
 */
export function thumbUrl(url: string, width: number): string {
  return `${url}${url.includes("?") ? "&" : "?"}w=${width}`;
}

/** Up to two uppercase initials from a name, for avatar fallbacks. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

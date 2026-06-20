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
 * Applied on a layout wrapper, it cascades to all `--primary` / `--ring` users.
 * `--primary-foreground` is set to whichever of white / ink contrasts better with
 * the chosen accent, so a light accent never leaves the button text unreadable
 * (WCAG; ENH-UX-02).
 */
export function accentVars(hex?: string | null): CSSProperties | undefined {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return undefined;
  const L = luminance(hex);
  const onWhite = 1.05 / (L + 0.05); // contrast of white text on the accent
  const onInk = (L + 0.05) / (luminance("#221d16") + 0.05); // ink text on the accent
  const foreground = onWhite >= onInk ? "#ffffff" : "#221d16";
  return { "--primary": hex, "--ring": hex, "--primary-foreground": foreground } as CSSProperties;
}

/** Up to two uppercase initials from a name, for avatar fallbacks. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

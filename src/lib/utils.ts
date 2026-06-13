import type { CSSProperties } from "react";

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Inline style overriding the accent CSS variables for a per-workspace brand.
 * Returns undefined for a missing/invalid hex so the default palette stands.
 * Applied on a layout wrapper, it cascades to all `--primary` / `--ring` users.
 */
export function accentVars(hex?: string | null): CSSProperties | undefined {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return undefined;
  return { "--primary": hex, "--ring": hex } as CSSProperties;
}

/** Up to two uppercase initials from a name, for avatar fallbacks. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

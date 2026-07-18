import { cn } from "@/lib/utils";

/**
 * BragBit brand mark — the "marked entry" logbook glyph: a timeline spine with
 * one highlighted win. Knocked out of a rounded tile that uses the workspace
 * accent (`--primary`), so it white-labels; the glyph inherits
 * `--primary-foreground` via `currentColor`. Mirrors the app icon
 * (`src/app/icon.svg`). Rendered as the fallback identity when a workspace has
 * no uploaded logo; decorative, so an adjacent name (or the link's aria-label)
 * carries the accessible label.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid aspect-square place-items-center rounded-lg bg-primary text-primary-foreground shadow-[inset_0_-8px_14px_rgba(0,0,0,0.18)]",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="138 131 250 250" className="h-[62%] w-[62%]" fill="currentColor">
        <rect x="170" y="156" width="20" height="200" rx="10" />
        <circle cx="180" cy="190" r="17" />
        <circle cx="180" cy="256" r="30" />
        <circle cx="180" cy="322" r="17" />
        <rect x="218" y="180" width="86" height="20" rx="10" />
        <rect x="218" y="241" width="158" height="30" rx="15" />
        <rect x="218" y="312" width="72" height="20" rx="10" />
      </svg>
    </span>
  );
}

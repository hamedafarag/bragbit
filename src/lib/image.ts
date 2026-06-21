import "server-only";

import sharp from "sharp";

/**
 * Allowlisted thumbnail widths (px). A `?w=` request must match one of these, so
 * the authorizing file route never resizes to an arbitrary (CPU-abusable)
 * dimension. Picked to cover the render sites: avatar chips, attachment chips,
 * inline previews, logos. (ENH-PERF-02)
 */
export const THUMB_WIDTHS = [64, 192, 400, 800] as const;
export type ThumbWidth = (typeof THUMB_WIDTHS)[number];

/** Raster image content types `sharp` can downscale (not PDFs / docs / SVG). */
const THUMBNAILABLE = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** Validate a `?w=` value against the allowlist; null if absent or off-list. */
export function parseThumbWidth(raw: string | null): ThumbWidth | null {
  if (!raw) return null;
  const n = Number(raw);
  return (THUMB_WIDTHS as readonly number[]).includes(n) ? (n as ThumbWidth) : null;
}

/** Whether a content type is a raster image we can thumbnail. */
export function isThumbnailable(contentType: string): boolean {
  return THUMBNAILABLE.has(contentType);
}

/**
 * Downscale `buffer` to fit `width` (never upscaling), auto-orient via EXIF, and
 * re-encode as webp — the thumbnail served for previews. Animated inputs collapse
 * to their first frame.
 */
export async function thumbnail(buffer: Buffer, width: ThumbWidth): Promise<Buffer> {
  return sharp(buffer, { animated: false })
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

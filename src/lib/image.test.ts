import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { isThumbnailable, parseThumbWidth, thumbnail } from "./image";

describe("parseThumbWidth", () => {
  it("accepts an allowlisted width", () => {
    expect(parseThumbWidth("192")).toBe(192);
    expect(parseThumbWidth("800")).toBe(800);
  });

  it("rejects an absent, non-numeric, or off-list width", () => {
    expect(parseThumbWidth(null)).toBeNull();
    expect(parseThumbWidth("")).toBeNull();
    expect(parseThumbWidth("abc")).toBeNull();
    expect(parseThumbWidth("500")).toBeNull(); // not on the allowlist
    expect(parseThumbWidth("191")).toBeNull();
  });
});

describe("isThumbnailable", () => {
  it("is true for raster images, false for everything else", () => {
    expect(isThumbnailable("image/png")).toBe(true);
    expect(isThumbnailable("image/jpeg")).toBe(true);
    expect(isThumbnailable("image/webp")).toBe(true);
    expect(isThumbnailable("application/pdf")).toBe(false);
    expect(isThumbnailable("image/svg+xml")).toBe(false);
  });
});

describe("thumbnail", () => {
  it("downscales to the target width and re-encodes as webp", async () => {
    const src = await sharp({
      create: { width: 1000, height: 800, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();

    const thumb = await thumbnail(src, 192);
    const meta = await sharp(thumb).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(192);
    expect(thumb.length).toBeLessThan(src.length);
  });

  it("never upscales a smaller image", async () => {
    const src = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "blue" },
    })
      .png()
      .toBuffer();

    const thumb = await thumbnail(src, 800);
    const meta = await sharp(thumb).metadata();
    expect(meta.width).toBe(100);
  });
});

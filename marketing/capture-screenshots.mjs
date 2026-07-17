/**
 * Regenerates the screenshots on the marketing page from the real running app.
 *
 * Run it whenever the UI changes — the page's whole claim is that these are real
 * captures, so a stale shot is a lie by omission.
 *
 *   node marketing/capture-screenshots.mjs [outDir]
 *
 * Prerequisites (see marketing/README.md for the full recipe):
 *   • the dev server on :3000, in `private-solo` mode, against a seeded database
 *   • `pnpm seed:demo` run against that database (demo@bragbit.local / demobragbit)
 *
 * Captures at deviceScaleFactor 2 so the page can display them at half size and
 * stay crisp on retina. The Next dev-tools indicator is hidden — it's a dev
 * overlay, not part of the product.
 *
 * Output is WebP (q82), not PNG: these are the page's largest assets and its LCP,
 * which search ranks on. At 2x captured / 1x displayed, q82 measures a 0.48% mean
 * channel difference from the PNG at display scale — invisible — for ~72% fewer
 * bytes. It also writes og.png: link-preview scrapers handle WebP poorly, and the
 * Open Graph spec wants 1200x630, so the social card is its own PNG.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "./marketing/screenshots";
const DOC = "/documents/demo-doc-2026";
const W = 1280;
const WEBP = { quality: 82 };

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: W, height: 860 },
  deviceScaleFactor: 2,
  colorScheme: "light",
});

// Sign in through the real auth endpoint; the context cookie jar carries the
// session into page navigations.
const res = await ctx.request.post(`${BASE}/api/auth/sign-in/email`, {
  data: { email: "demo@bragbit.local", password: "demobragbit" },
});
if (!res.ok()) {
  throw new Error(
    `sign-in failed (${res.status()}). Is the dev server up, in private-solo mode, ` +
      `with \`pnpm seed:demo\` applied to its database?`,
  );
}

const page = await ctx.newPage();

// Fonts must land before any capture or we shoot the fallback face.
const settle = async () => {
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
};
// Playwright only encodes PNG/JPEG, so shoot to a buffer and let sharp emit WebP.
const shot = async (name, opts) => {
  const buf = await page.screenshot(opts);
  await sharp(buf).webp(WEBP).toFile(`${OUT}/${name}.webp`);
  console.log(`  ✓ ${name}.webp`);
  return buf;
};
const shotEl = async (name, locator) => {
  const buf = await locator.screenshot();
  await sharp(buf).webp(WEBP).toFile(`${OUT}/${name}.webp`);
  console.log(`  ✓ ${name}.webp`);
};

console.log("capturing…");

// 1. Hero — the document surface, top of page.
await page.goto(`${BASE}${DOC}`, { waitUntil: "networkidle" });
await settle();
const heroBuf = await shot("timeline", { clip: { x: 0, y: 0, width: W, height: 830 } });

// 2. The month-grouped spine.
await page.evaluate(() => window.scrollTo(0, 560));
await page.waitForTimeout(400);
await shot("timeline-cards", { clip: { x: 0, y: 60, width: W, height: 800 } });

// 3. Quick-add + the six template chips (a wide strip; shown full-bleed).
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(400);
await shot("capture", { clip: { x: 55, y: 355, width: 1160, height: 230 } });

// 4. The editor, opened from a template so the pre-filled scaffold shows.
await page.getByRole("button", { name: "Shipped a project" }).click();
await page.waitForTimeout(700);
await settle();
await shotEl("editor", page.getByRole("dialog"));
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

// 5. Share dialog, with a live link created so it shows the real state.
await page.getByRole("button", { name: "Share" }).first().click();
await page.waitForTimeout(700);
const create = page.getByRole("button", { name: "Create share link" });
if (await create.isVisible().catch(() => false)) {
  await create.click();
  await page.waitForTimeout(1200);
}
await settle();
await shotEl("share", page.getByRole("dialog"));
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

// 6 + 7. Dark mode — both the spine and the full hero, so the page can swap the
// hero with its own theme instead of showing a lit app on a dark page.
await ctx.addCookies([{ name: "theme", value: "dark", url: BASE }]);
await page.goto(`${BASE}${DOC}`, { waitUntil: "networkidle" });
await page.evaluate(() => window.scrollTo(0, 560));
await settle();
await shot("timeline-dark", { clip: { x: 0, y: 60, width: W, height: 800 } });

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(400);
await shot("timeline-full-dark", { clip: { x: 0, y: 0, width: W, height: 830 } });

// 8. Dashboard — heatmap + streak, back in light.
await ctx.clearCookies({ name: "theme" });
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await settle();
await shot("dashboard", { clip: { x: 0, y: 0, width: W, height: 580 } });

// The social card. PNG and 1200x630 on purpose — see the header comment.
await sharp(heroBuf)
  .resize({ width: 1200, height: 630, fit: "cover", position: "top" })
  .png({ compressionLevel: 9 })
  .toFile(`${OUT}/../og.png`);
console.log("  ✓ og.png (1200x630, social card)");

await browser.close();
console.log("done →", OUT);

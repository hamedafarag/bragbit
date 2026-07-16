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
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "./marketing/screenshots";
const DOC = "/documents/demo-doc-2026";
const W = 1280;

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
const shot = async (name, opts) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, ...opts });
  console.log(`  ✓ ${name}.png`);
};

console.log("capturing…");

// 1. Hero — the document surface, top of page.
await page.goto(`${BASE}${DOC}`, { waitUntil: "networkidle" });
await settle();
await shot("timeline", { clip: { x: 0, y: 0, width: W, height: 830 } });

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
await page.getByRole("dialog").screenshot({ path: `${OUT}/editor.png` });
console.log("  ✓ editor.png");
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
await page.getByRole("dialog").screenshot({ path: `${OUT}/share.png` });
console.log("  ✓ share.png");
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

await browser.close();
console.log("done →", OUT);

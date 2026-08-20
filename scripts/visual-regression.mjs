import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:5000";
const update = process.argv.includes("--update");
const routes = (process.env.VISUAL_ROUTES ?? "/,/reports,/dashboard").split(",");
const outputDir = path.resolve("test-results/ui-baselines");
fs.mkdirSync(outputDir, { recursive: true });

async function comparePixels(actual, expected) {
  const [a, e] = await Promise.all([
    sharp(actual).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(expected).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (a.info.width !== e.info.width || a.info.height !== e.info.height) return 1;
  let different = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const delta = Math.abs(a.data[i] - e.data[i]) + Math.abs(a.data[i + 1] - e.data[i + 1]) + Math.abs(a.data[i + 2] - e.data[i + 2]);
    if (delta > 24) different++;
  }
  return different / (a.info.width * a.info.height);
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`Visual regression skipped: Playwright browser is unavailable (${message.split("\n")[0]}).`);
  if (process.env.VISUAL_STRICT === "1") process.exit(1);
  process.exit(0);
}
try {
  for (const theme of ["light", "dark"]) {
    for (const route of routes) {
      const page = await browser.newPage({ colorScheme: theme });
      await page.addInitScript((selectedTheme) => {
        localStorage.setItem("theme", selectedTheme);
        document.documentElement.classList.toggle("dark", selectedTheme === "dark");
      }, theme);
      await page.goto(new URL(route.trim(), baseURL).href, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts?.ready);
      const file = path.join(outputDir, `${theme}-${route.trim().replaceAll("/", "_") || "home"}.png`);
      if (update || !fs.existsSync(file)) {
        await page.screenshot({ path: file, fullPage: true });
      } else {
        const actual = await page.screenshot({ fullPage: true });
        const expected = fs.readFileSync(file);
        const difference = await comparePixels(actual, expected);
        if (difference > 0.01) {
          throw new Error(`Visual regression detected: ${theme} ${route} (${(difference * 100).toFixed(2)}% pixels). Run npm run test:visual:update to refresh baselines.`);
        }
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}
console.log(`Visual regression check passed for ${routes.length} routes in light/dark themes.`);
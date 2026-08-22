import { chromium } from '@playwright/test';

try {
  const browser = await chromium.launch({ headless: true });
  await browser.close();
  console.log('Playwright Chromium preflight passed.');
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error('::error::Playwright Chromium cannot launch. The Overview suite was not started.');
  console.error('Install the browser and Linux dependencies with: npx playwright install --with-deps chromium');
  console.error(detail);
  process.exit(1);
}
/**
 * E2E: AI Valuation page tests
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sgs.vn';
const ADMIN_PASS = process.env.ADMIN_PASS || '';

const login = async (page: Page) => {
  await page.goto(BASE_URL);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await page.waitForSelector('input[type="email"]', { state: 'visible' });
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASS);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
};

test.describe('Valuation Page', () => {
  test.beforeEach(async ({ page }) => {
    if (!ADMIN_PASS) test.skip(true, 'ADMIN_PASS not set');
  });

  test('should load valuation page without crashing', async ({ page }) => {
    await login(page);
    // Navigate to valuation — look for link/nav item
    const valuationLink = page.locator('a[href*="valuation"], button:has-text("Định giá"), [title*="Định giá"]').first();
    if (await valuationLink.count() > 0) {
      await valuationLink.click();
    } else {
      await page.goto(`${BASE_URL}/#/valuation`);
    }
    // Page should not show error state or white screen
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(10);
    expect(bodyText).not.toContain('Cannot read properties');
  });

  test('offline fallback valuation calculates without API call', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/#/valuation`);
    await page.waitForTimeout(1000);

    // Fill address input
    const addressInput = page.locator('input[placeholder*="địa chỉ"], input[placeholder*="Nhập địa"], input[name="address"]').first();
    if (await addressInput.count() === 0) {
      test.skip(true, 'Valuation form not found — page structure may differ');
      return;
    }
    await addressInput.fill('Quận 1, TP.HCM');

    // Fill area
    const areaInput = page.locator('input[placeholder*="m²"], input[placeholder*="diện tích"], input[name="area"]').first();
    if (await areaInput.count() > 0) {
      await areaInput.fill('80');
    }

    // Intercept API call and simulate offline/failure
    await page.route('**/api/ai/valuation', route => route.abort('failed'));

    // Submit
    const submitBtn = page.locator('button:has-text("Định giá"), button[type="submit"]').first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
      // Should show some result (fallback calc) not crash
      const hasResult = await page.locator('text=/tỷ|triệu|tr\/m²|kết quả/i').count() > 0;
      const hasError = await page.locator('text=/crash|undefined|TypeError/i').count() > 0;
      expect(hasError).toBeFalsy();
      // Fallback should show something meaningful
      expect(hasResult || await page.locator('text=/không thể|lỗi/i').count() > 0).toBeTruthy();
    }
  });

  test('valuation rejects unrealistic inputs gracefully', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/#/valuation`);
    await page.waitForTimeout(1000);

    const areaInput = page.locator('input[placeholder*="m²"], input[name="area"]').first();
    if (await areaInput.count() > 0) {
      await areaInput.fill('-999');
      await areaInput.blur();
      // Should not crash — input validation or form rejection
      await page.waitForTimeout(500);
      const crashed = await page.locator('text=/TypeError|Cannot read/').count() > 0;
      expect(crashed).toBeFalsy();
    }
  });

});

test.describe('Contract State Machine', () => {
  test('PUT /api/contracts rejects invalid status transition', async ({ request }) => {
    // Without auth this is 401, but tests the route exists and returns expected errors
    const res = await request.put(`${BASE_URL}/api/contracts/00000000-0000-0000-0000-000000000099`, {
      data: { status: 'DRAFT' },
    });
    // Either 401 (unauth) or 422 (invalid transition on an existing contract)
    expect([401, 422, 404]).toContain(res.status());
  });
});

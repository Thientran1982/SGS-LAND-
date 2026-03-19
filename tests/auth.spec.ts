/**
 * E2E: Authentication & Authorization flows
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sgs.vn';
const ADMIN_PASS = process.env.ADMIN_PASS || '';

// --- Helpers ---
const gotoLogin = async (page: Page) => {
  await page.goto(BASE_URL);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForSelector('input[type="email"]', { state: 'visible' });
};

// --- Auth Tests ---
test.describe('Authentication', () => {

  test('should reject wrong password with 401 error message', async ({ page }) => {
    await gotoLogin(page);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', 'wrong_password_xyz');
    await page.click('button[type="submit"]');

    // Should NOT redirect to dashboard
    await page.waitForTimeout(2000);
    await expect(page).not.toHaveURL(/dashboard/);

    // Should show error — either inline or toast
    const hasError = await page.locator('text=/sai|incorrect|invalid|không đúng|lỗi/i').count() > 0;
    expect(hasError, 'Should display login error message').toBeTruthy();
  });

  test('should reject empty credentials', async ({ page }) => {
    await gotoLogin(page);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
    await expect(page).not.toHaveURL(/dashboard/);
  });

  test('should reject SQL injection in email field', async ({ page }) => {
    await gotoLogin(page);
    await page.fill('input[type="email"]', "' OR '1'='1' --");
    await page.fill('input[type="password"]', 'anything');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    await expect(page).not.toHaveURL(/dashboard/);
  });

  test('should logout and clear session', async ({ page }) => {
    await gotoLogin(page);
    if (!ADMIN_PASS) {
      test.skip(true, 'ADMIN_PASS env var not set');
      return;
    }
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/);

    // Find and click logout
    const logoutBtn = page.locator('button:has-text("Đăng xuất"), button[aria-label="Logout"], button[title="Logout"]').first();
    if (await logoutBtn.count() > 0) {
      await logoutBtn.click();
      await page.waitForURL(url => !url.toString().includes('dashboard'), { timeout: 5000 });
    }
    // localStorage should be cleared after logout
    const token = await page.evaluate(() => localStorage.getItem('auth_token') || document.cookie);
    expect(token).toBeFalsy();
  });

  test('should redirect unauthenticated users away from /dashboard', async ({ page }) => {
    // Clear session then try to access dashboard directly
    await page.goto(BASE_URL);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${BASE_URL}/#/dashboard`);
    await page.waitForTimeout(1500);
    // Should redirect to login or show login form
    const isOnLogin = await page.locator('input[type="email"]').count() > 0;
    const isNotOnDash = !page.url().includes('dashboard') || isOnLogin;
    expect(isNotOnDash, 'Unauthenticated users should not access dashboard').toBeTruthy();
  });

});

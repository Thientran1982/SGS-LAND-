import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sgs.vn';
const ADMIN_PASS = process.env.ADMIN_PASS || '';

test.skip(!ADMIN_PASS, 'requires ADMIN_PASS for authenticated social connection regression');

async function login(page: Page) {
  await page.goto(BASE_URL);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASS);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });
}

async function openConnectionModal(page: Page) {
  await page.goto(`${BASE_URL}/data-platform`);
  await expect(page.getByRole('button', { name: /Thêm Kết Nối|Add Connection/i })).toBeVisible();
  await page.getByRole('button', { name: /Thêm Kết Nối|Add Connection/i }).click();
  await expect(page.getByRole('heading', { name: /Cấu Hình Kết Nối|Connection Config/i })).toBeVisible();
}

function connectionTypeDropdown(page: Page) {
  return page.locator('[role="dialog"] button[aria-haspopup="listbox"], .fixed button[aria-haspopup="listbox"]').first();
}

test.describe('social connection destinations', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('lists data connectors and social providers with UI icons', async ({ page }) => {
    await openConnectionModal(page);
    const typeButton = connectionTypeDropdown(page);
    await typeButton.click();

    for (const label of [
      'Google Sheets',
      'HubSpot CRM',
      'Zoho CRM',
      'Salesforce',
      'Webhook Export',
      'Facebook Page',
      'Zalo OA',
      'Instagram Business',
      'TikTok Business',
      'LinkedIn Page',
    ]) {
      await expect(page.getByRole('option', { name: label })).toBeVisible();
    }
    expect(await page.getByRole('option').evaluateAll(options => options.map(option => option.querySelectorAll('svg').length))).toEqual(
      expect.arrayContaining([1]),
    );
    await expect(page.locator('text=/😀|😃|😄|😁|😂|🤣|😉|😊|😍|🤝|📈|🔗/')).toHaveCount(0);
  });

  test('keeps data connector configuration on the save path', async ({ page }) => {
    await openConnectionModal(page);
    await connectionTypeDropdown(page).click();
    await page.getByRole('option', { name: 'Webhook Export' }).click();

    await expect(page.getByPlaceholder('https://hooks.zapier.com/...')).toBeVisible();
    await expect(page.getByRole('button', { name: /Lưu|Save/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Mở cài đặt và kiểm tra|Open settings/i })).toHaveCount(0);
  });

  test('routes Facebook and Zalo to their Enterprise Settings tabs', async ({ page }) => {
    await openConnectionModal(page);
    const typeButton = connectionTypeDropdown(page);

    await typeButton.click();
    await page.getByRole('option', { name: 'Facebook Page' }).click();
    await page.getByRole('button', { name: /Mở cài đặt và kiểm tra|Open settings/i }).click();
    await expect(page).toHaveURL(/\/enterprise-settings\?tab=FACEBOOK/);

    await page.goto(`${BASE_URL}/data-platform`);
    await page.getByRole('button', { name: /Thêm Kết Nối|Add Connection/i }).click();
    await connectionTypeDropdown(page).click();
    await page.getByRole('option', { name: 'Zalo OA' }).click();
    await page.getByRole('button', { name: /Mở cài đặt và kiểm tra|Open settings/i }).click();
    await expect(page).toHaveURL(/\/enterprise-settings\?tab=ZALO/);
  });

  test('routes unsupported social providers to their readiness catalog without enabling them', async ({ page }) => {
    await openConnectionModal(page);
    const typeButton = connectionTypeDropdown(page);
    await typeButton.click();
    await page.getByRole('option', { name: 'TikTok Business' }).click();
    await page.getByRole('button', { name: /Mở cài đặt và kiểm tra|Open settings/i }).click();
    await expect(page).toHaveURL(/\/social-publishing\?platform=TIKTOK/);
    await expect(page.locator('[data-social-platform="TIKTOK"]')).toBeVisible();
    await expect(page.locator('[data-social-platform="TIKTOK"] input')).toBeDisabled();
    await expect(page.locator('[data-social-platform="TIKTOK"]')).toContainText(/Không hỗ trợ|Chưa sẵn sàng/);
  });
});
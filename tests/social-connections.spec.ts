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

const privateConnectionCases = [
  { option: 'Google Sheets', marker: /Spreadsheet|ID bảng tính|spreadsheet/i, social: false },
  { option: 'HubSpot CRM', marker: /API key|khóa API/i, social: false },
  { option: 'Salesforce', marker: /API key|khóa API/i, social: false },
  { option: 'Webhook', marker: /Target URL|Webhook secret|URL đích/i, social: false },
  { option: 'Facebook', marker: /Page ID/i, social: true },
  { option: 'Zalo', marker: /App ID|OA ID/i, social: true },
  { option: 'Instagram', marker: /Business Account ID/i, social: true },
  { option: 'TikTok', marker: /Business\/Account ID/i, social: true },
  { option: 'LinkedIn', marker: /Organization ID/i, social: true },
] as const;

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
      'Webhook',
      'Facebook',
      'Zalo',
      'Instagram',
      'TikTok',
      'LinkedIn',
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
    await page.getByRole('option', { name: 'Webhook' }).click();

    await expect(page.getByPlaceholder('https://hooks.zapier.com/...')).toBeVisible();
    await expect(page.getByPlaceholder('Secret ký request')).toBeVisible();
    await expect(page.getByRole('button', { name: /Lưu|Save/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Mở cài đặt và kiểm tra|Open settings/i })).toHaveCount(0);
  });

  test('selects every private connection type without opening the wrong screen', async ({ page }) => {
    await openConnectionModal(page);

    for (const connection of privateConnectionCases) {
      await connectionTypeDropdown(page).click();
      await page.getByRole('option', { name: connection.option, exact: true }).click();
      await expect(page.locator('label').filter({ hasText: connection.marker })).toBeVisible();

      if (connection.social) {
        await expect(page.getByRole('button', { name: /Mở cài đặt và kiểm tra|Open settings/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Lưu|Save/i })).toHaveCount(0);
      } else {
        await expect(page.getByRole('button', { name: /Lưu|Save/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Mở cài đặt và kiểm tra|Open settings/i })).toHaveCount(0);
      }
    }
  });

  test('keeps social credentials in the private modal instead of opening another screen', async ({ page }) => {
    await openConnectionModal(page);
    const typeButton = connectionTypeDropdown(page);

    await typeButton.click();
    await page.getByRole('option', { name: 'Facebook', exact: true }).click();
    await expect(page.getByText(/Page ID/i)).toBeVisible();
    await expect(page).toHaveURL(/\/data-platform/);

    await page.goto(`${BASE_URL}/data-platform`);
    await page.getByRole('button', { name: /Thêm Kết Nối|Add Connection/i }).click();
    await connectionTypeDropdown(page).click();
    await page.getByRole('option', { name: 'Zalo', exact: true }).click();
    await expect(page.getByText(/App ID/i)).toBeVisible();
    await expect(page).toHaveURL(/\/data-platform/);
  });

  test('keeps unsupported social providers as credential forms without enabling sync', async ({ page }) => {
    await openConnectionModal(page);
    const typeButton = connectionTypeDropdown(page);
    await typeButton.click();
    await page.getByRole('option', { name: 'TikTok', exact: true }).click();
    await expect(page.getByText(/Business\/Account ID/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Mở cài đặt và kiểm tra|Open settings/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Lưu|Save/i })).toHaveCount(0);
    await expect(page.locator('button[title*="sync" i]')).toHaveCount(0);
  });

  test('does not render a sync action for a saved social connector', async ({ page }) => {
    await page.route('**/api/connectors', async route => {
      const url = new URL(route.request().url());
      if (route.request().method() !== 'GET' || url.pathname !== '/api/connectors') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'social-connector-a',
          ownerUserId: 'user-a',
          type: 'TIKTOK',
          name: 'TikTok owned by user A',
          status: 'ACTIVE',
          config: { accountId: 'account-a', accessToken: '[REDACTED]' },
        }]),
      });
    });

    await page.goto(`${BASE_URL}/data-platform`);
    const card = page.getByRole('heading', { name: 'TikTok owned by user A' }).locator('xpath=../../..');
    await expect(card).toBeVisible();
    await expect(card.getByTitle(/Đồng bộ ngay|Sync Now/i)).toHaveCount(0);
    await expect(card.getByTitle(/Kiểm tra sâu cấu hình|Check/i)).toHaveCount(1);
  });
});

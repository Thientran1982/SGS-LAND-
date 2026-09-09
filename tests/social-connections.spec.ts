import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sgs.vn';
const ADMIN_PASS = process.env.ADMIN_PASS || '';
const DATABASE_URL = process.env.AIVEN_DATABASE_URL;
const FIXTURE_TENANT_ID = '00000000-0000-0000-0000-000000000001';

function hasUsableDatabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const { hostname } = new URL(value);
    return Boolean(hostname && !['undefined', 'null', 'localhost'].includes(hostname));
  } catch {
    return false;
  }
}

const useDatabaseFixture =
  hasUsableDatabaseUrl(DATABASE_URL) &&
  (process.env.SOCIAL_CONNECTION_AUTH === 'fixture' ||
    process.env.CI === 'true' ||
    process.env.CI === '1');
test.skip(
  !ADMIN_PASS && !useDatabaseFixture,
  'requires AIVEN_DATABASE_URL for the isolated auth fixture or ADMIN_PASS for local fallback',
);

function databaseConnectionString() {
  return DATABASE_URL!
    .replace(/[?&](?:sslmode|channel_binding)=[^&]*/gi, '')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');
}

let fixtureDb: Pool | undefined;
let fixtureUserId = '';
let authEmail = ADMIN_EMAIL;
let authPassword = ADMIN_PASS;

test.beforeAll(async () => {
  if (!useDatabaseFixture) return;

  fixtureDb = new Pool({
    connectionString: databaseConnectionString(),
    max: 1,
    connectionTimeoutMillis: 15_000,
    ssl: { rejectUnauthorized: false },
  });

  authEmail = `social-connector-e2e-${randomUUID()}@example.test`;
  authPassword = `SocialConnector-${randomUUID()}`;
  const passwordHash = await bcrypt.hash(authPassword, 12);
  const result = await fixtureDb.query(
    `INSERT INTO users
      (tenant_id, name, email, password_hash, role, status, email_verified, source, metadata)
     VALUES ($1, $2, $3, $4, 'SUPER_ADMIN', 'ACTIVE', TRUE, 'E2E_FIXTURE', $5)
     RETURNING id`,
    [
      FIXTURE_TENANT_ID,
      'Social connector E2E fixture',
      authEmail,
      passwordHash,
      JSON.stringify({ test: 'social-connections' }),
    ],
  );
  fixtureUserId = String(result.rows[0].id);
});

test.afterAll(async () => {
  try {
    if (fixtureDb && fixtureUserId) {
      await fixtureDb.query(
        'DELETE FROM users WHERE id = $1 AND tenant_id = $2',
        [fixtureUserId, FIXTURE_TENANT_ID],
      );
    }
  } finally {
    await fixtureDb?.end();
  }
});

async function login(page: Page) {
  const response = await page.request.post(`${BASE_URL}/api/auth/login`, {
    data: { email: authEmail, password: authPassword },
  });
  expect(response.status(), 'fixture login should succeed').toBe(200);
  const body = await response.json();
  expect(body.token, 'login should return a session token').toBeTruthy();
  await page.context().addCookies([
    {
      name: 'token',
      value: body.token,
      url: BASE_URL,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  await page.goto(BASE_URL);
  await page.evaluate((token) => {
    localStorage.setItem('auth_token', token);
  }, body.token);
  await page.goto(`${BASE_URL}/data-platform`);
  await expect(
    page.getByRole('button', { name: /Thêm Kết Nối|Add Connection/i }),
  ).toBeVisible();
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
    const card = page.getByRole('heading', { name: 'TikTok owned by user A' }).locator('xpath=../../../../');
    await expect(card).toBeVisible();
    await expect(card.getByTitle(/Đồng bộ ngay|Sync Now/i)).toHaveCount(0);
    await expect(card.getByTitle(/Kiểm tra sâu cấu hình|Check/i)).toHaveCount(1);
  });

  test('starts and displays completed syncs for every supported data connector', async ({ page }) => {
    const connectors = [
      {
        id: 'connector-google',
        type: 'GOOGLE_SHEETS',
        name: 'Google Sheets fixture',
        status: 'ACTIVE',
        config: { spreadsheetId: 'sheet-a', accessToken: '[REDACTED]' },
      },
      {
        id: 'connector-hubspot',
        type: 'HUBSPOT',
        name: 'HubSpot fixture',
        status: 'ACTIVE',
        config: { apiKey: '[REDACTED]' },
      },
      {
        id: 'connector-webhook',
        type: 'WEBHOOK_EXPORT',
        name: 'Webhook fixture',
        status: 'ACTIVE',
        config: { targetUrl: 'https://hooks.example.test/leads', secret: '[REDACTED]' },
      },
      {
        id: 'connector-salesforce',
        type: 'SALESFORCE',
        name: 'Salesforce fixture',
        status: 'ACTIVE',
        config: { apiKey: '[REDACTED]' },
      },
    ];
    const completedJobs = new Map<string, any>();
    const queuedJobs: any[] = [];

    await page.route('**/api/connectors', async route => {
      const url = new URL(route.request().url());
      if (route.request().method() === 'GET' && url.pathname === '/api/connectors') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(connectors) });
        return;
      }
      await route.continue();
    });
    await page.route('**/api/connectors/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === '/api/connectors/jobs' && request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([...queuedJobs, ...completedJobs.values()]),
        });
        return;
      }
      const syncMatch = url.pathname.match(/^\/api\/connectors\/([^/]+)\/sync$/);
      if (syncMatch && request.method() === 'POST') {
        const connectorId = syncMatch[1];
        const job = {
          id: `job-${connectorId}`,
          connectorId,
          startedAt: '2026-09-09T00:00:00.000Z',
          status: 'QUEUED',
          recordsProcessed: 42,
          errors: [],
          retryCount: 0,
        };
        queuedJobs.push(job);
        completedJobs.set(connectorId, { ...job, status: 'COMPLETED' });
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(job) });
        return;
      }
      await route.continue();
    });

    await page.goto(`${BASE_URL}/data-platform`);
    for (const connector of connectors) {
      const card = page.getByRole('heading', { name: connector.name }).locator('xpath=../../../../');
      await expect(card).toBeVisible();
      await expect(card.getByTitle(/Đồng bộ ngay|Sync Now/i)).toHaveCount(1);
      const syncResponsePromise = page.waitForResponse(response =>
        response.request().method() === 'POST'
        && new URL(response.url()).pathname === `/api/connectors/${connector.id}/sync`,
      );
      await card.getByTitle(/Đồng bộ ngay|Sync Now/i).click();
      const syncResponse = await syncResponsePromise;
      expect(syncResponse.status()).toBe(201);
      await expect(syncResponse.json()).resolves.toMatchObject({
        connectorId: connector.id,
        status: 'QUEUED',
      });
      await expect(page.getByRole('status')).toContainText(/Bắt đầu đồng bộ|Sync started/i);
    }

    expect([...completedJobs.keys()]).toEqual(connectors.map(connector => connector.id));
    await expect(page.getByText(/Hoàn thành|Completed/i)).toHaveCount(4);
    await expect(page.locator('body')).not.toContainText(/sheet-a|hooks\.example\.test|api-key|hubspot-secret|salesforce-secret/i);
  });
});

import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { expect, test } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const HOST_TENANT = '00000000-0000-0000-0000-000000000001';
const DATABASE_URL = process.env.AIVEN_DATABASE_URL;

function hasUsableDatabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const { hostname } = new URL(value);
    return Boolean(hostname && !['undefined', 'null', 'localhost'].includes(hostname));
  } catch {
    return false;
  }
}

test.skip(
  !hasUsableDatabaseUrl(DATABASE_URL),
  'requires AIVEN_DATABASE_URL with a reachable development hostname',
);

function databaseConnectionString() {
  return DATABASE_URL!
    .replace(/[?&](?:sslmode|channel_binding)=[^&]*/gi, '')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');
}

test.describe('Authenticated public live chat', () => {
  let db: Pool;
  let fixtureUserId = '';
  let fixtureEmail = '';
  const fixturePassword = `LiveChat-${randomUUID()}`;

  test.beforeAll(async () => {
    db = new Pool({
      connectionString: databaseConnectionString(),
      max: 1,
      connectionTimeoutMillis: 15_000,
      ssl: { rejectUnauthorized: false },
    });

    fixtureEmail = `livechat-auth-smoke-${randomUUID()}@example.test`;
    const passwordHash = await bcrypt.hash(fixturePassword, 12);
    const result = await db.query(
      `INSERT INTO users
        (tenant_id, name, email, password_hash, role, status, email_verified, source, phone)
       VALUES ($1, $2, $3, $4, 'VIEWER', 'ACTIVE', TRUE, 'E2E_FIXTURE', NULL)
       RETURNING id`,
      [HOST_TENANT, 'Live chat authenticated fixture', fixtureEmail, passwordHash],
    );
    fixtureUserId = String(result.rows[0].id);
  });

  test.afterAll(async () => {
    try {
      if (fixtureUserId) {
        await db.query(
          `DELETE FROM landing_pages
           WHERE visitor_key IN (
             SELECT id::text FROM leads
             WHERE metadata->>'authenticated_user_id' = $1
           )`,
          [fixtureUserId],
        );
        await db.query(
          `DELETE FROM leads WHERE metadata->>'authenticated_user_id' = $1`,
          [fixtureUserId],
        );
        await db.query('DELETE FROM users WHERE id = $1 AND tenant_id = $2', [
          fixtureUserId,
          HOST_TENANT,
        ]);
      }
    } finally {
      await db?.end();
    }
  });

  test('restores one CRM lead for the signed-in user and creates a landing link', async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);

    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: fixtureEmail, password: fixturePassword },
    });
    expect(loginResponse.status()).toBe(200);
    const loginBody = await loginResponse.json();
    expect(loginBody.user?.id).toBe(fixtureUserId);
    expect(loginBody.token).toBeTruthy();

    await page.context().addCookies([
      {
        name: 'token',
        value: loginBody.token,
        url: BASE_URL,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    const firstLeadResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/public/leads') &&
        response.request().method() === 'POST',
    );
    await page.goto(`${BASE_URL}/livechat`, { waitUntil: 'domcontentloaded' });
    const firstLead = await firstLeadResponse;
    expect(firstLead.status()).toBe(201);
    const firstLeadBody = await firstLead.json();
    expect(firstLeadBody.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(firstLeadBody.deduped).not.toBe(true);

    await expect(page.getByLabel('Họ và tên')).toHaveCount(0);
    await expect(page.getByLabel('Số điện thoại')).toHaveCount(0);
    await expect(page.getByLabel('Nội dung tin nhắn')).toBeVisible();

    const leadBeforeReload = await db.query(
      `SELECT id, name, phone, email, source, metadata
       FROM leads
       WHERE id = $1
         AND tenant_id = $2`,
      [firstLeadBody.id, HOST_TENANT],
    );
    expect(leadBeforeReload.rows).toHaveLength(1);
    expect(leadBeforeReload.rows[0].name).toBe('Live chat authenticated fixture');
    expect(leadBeforeReload.rows[0].phone).toBeNull();
    expect(leadBeforeReload.rows[0].email).toBe(fixtureEmail);
    expect(leadBeforeReload.rows[0].source).toBe('WEB');
    expect(leadBeforeReload.rows[0].metadata).toMatchObject({
      authenticated_user_id: fixtureUserId,
      authenticated_tenant_id: HOST_TENANT,
      auth_source: 'authenticated_livechat',
    });

    // Clearing browser state simulates a new device. The authenticated
    // account must still resolve to the same durable CRM conversation.
    await page.evaluate(() => localStorage.clear());
    const restoredLeadResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/public/leads') &&
        response.request().method() === 'POST',
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    const restoredLead = await restoredLeadResponse;
    expect(restoredLead.status()).toBe(201);
    const restoredLeadBody = await restoredLead.json();
    expect(restoredLeadBody.id).toBe(firstLeadBody.id);
    expect(restoredLeadBody.deduped).toBe(true);
    await expect(page.getByLabel('Họ và tên')).toHaveCount(0);
    await expect(page.getByLabel('Số điện thoại')).toHaveCount(0);

    const leadCount = await db.query(
      `SELECT count(*)::int AS count
       FROM leads
       WHERE tenant_id = $1
         AND metadata->>'authenticated_user_id' = $2`,
      [HOST_TENANT, fixtureUserId],
    );
    expect(leadCount.rows[0].count).toBe(1);

    const brief = `Tạo landing page smoke test cho dự án Aqua City ${randomUUID()}`;
    const messageBox = page.getByLabel('Nội dung tin nhắn');
    await messageBox.fill(brief);
    await messageBox.press('Enter');

    await expect(page.locator('[aria-live="polite"]')).toContainText(
      /\/landing\/[a-z0-9%_-]+/i,
      { timeout: 210_000 },
    );

    const landingPages = await db.query(
      `SELECT slug, visitor_key
       FROM landing_pages
       WHERE tenant_id = $1 AND visitor_key = $2`,
      [HOST_TENANT, firstLeadBody.id],
    );
    expect(landingPages.rows).toHaveLength(1);
    expect(landingPages.rows[0].slug).toMatch(/^[a-z0-9-]+$/);
  });
});
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { expect, test } from '@playwright/test';

// The configured preview runs the CRM Vite app on 5001 behind the public
// Next.js site on 5000. Allow CI or an alternate local workflow to override it.
const BASE_URL = process.env.SOCIAL_PUBLISHING_BASE_URL
  || process.env.BASE_URL
  || 'http://localhost:5001';
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

test.describe('Authenticated social publishing', () => {
  let db: Pool | undefined;
  let fixtureTenantId = '';
  let fixtureUserId = '';
  let fixtureListingId = '';
  let fixtureEmail = '';
  const fixturePassword = `SocialPublishing-${randomUUID()}`;
  const fixtureImageUrl = 'https://example.com/social-publishing-smoke.jpg';

  test.beforeAll(async () => {
    db = new Pool({
      connectionString: databaseConnectionString(),
      max: 1,
      connectionTimeoutMillis: 15_000,
      ssl: { rejectUnauthorized: false },
    });
    // This fixture is disposable. Suppress audit triggers on the dedicated
    // fixture connection so deleting the tenant cannot cascade into the
    // append-only learning audit table.
    await db.query('SET session_replication_role = replica');

    fixtureTenantId = randomUUID();
    fixtureEmail = `social-publishing-smoke-${randomUUID()}@example.test`;
    fixtureListingId = randomUUID();
    const passwordHash = await bcrypt.hash(fixturePassword, 12);

    await db.query(
      `INSERT INTO tenants (id, name, domain)
       VALUES ($1, $2, $3)`,
      [fixtureTenantId, 'Social publishing browser smoke', `${fixtureTenantId}.example.test`],
    );
    const userResult = await db.query(
      `INSERT INTO users
        (tenant_id, name, email, password_hash, role, status, email_verified, source, phone)
       VALUES ($1, $2, $3, $4, 'MARKETING', 'ACTIVE', TRUE, 'E2E_FIXTURE', NULL)
       RETURNING id`,
      [fixtureTenantId, 'Social publishing smoke manager', fixtureEmail, passwordHash],
    );
    fixtureUserId = String(userResult.rows[0].id);
    await db.query(
      `INSERT INTO listings
        (id, tenant_id, code, title, location, price, currency, area, bedrooms,
         bathrooms, type, status, transaction, images, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'VND', $7, $8, $9, $10, 'AVAILABLE',
               'SALE', $11::jsonb, $12)`,
      [
        fixtureListingId,
        fixtureTenantId,
        `SOCIAL-SMOKE-${fixtureListingId.slice(0, 8)}`,
        'Social publishing browser smoke listing',
        'Thủ Đức, TP.HCM',
        3200000000,
        72,
        2,
        2,
        'APARTMENT',
        JSON.stringify([fixtureImageUrl]),
        fixtureUserId,
      ],
    );
  });

  test.afterAll(async () => {
    try {
      await db?.query('SET session_replication_role = replica');
      if (db && fixtureListingId) {
        await db.query('DELETE FROM social_publications WHERE listing_id = $1', [fixtureListingId]);
        await db.query('DELETE FROM listings WHERE id = $1 AND tenant_id = $2', [
          fixtureListingId,
          fixtureTenantId,
        ]);
      }
      if (db && fixtureUserId) {
        await db.query('DELETE FROM users WHERE id = $1 AND tenant_id = $2', [
          fixtureUserId,
          fixtureTenantId,
        ]);
      }
      if (db && fixtureTenantId) {
        await db.query('DELETE FROM tenants WHERE id = $1', [fixtureTenantId]);
      }
    } finally {
      await db?.end();
    }
  });

  test('previews, saves, and activates a multi-platform draft without provider POSTs', async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);

    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: fixtureEmail, password: fixturePassword },
    });
    expect(loginResponse.status()).toBe(200);
    const loginBody = await loginResponse.json();
    expect(loginBody.user).toMatchObject({
      id: fixtureUserId,
      role: 'MARKETING',
    });
    expect(loginBody.token).toBeTruthy();

    // Load the SPA once so the CSRF cookie is present, then attach the
    // authenticated session returned by the real login endpoint.
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.context().addCookies([{
      name: 'token',
      value: loginBody.token,
      url: BASE_URL,
      httpOnly: true,
      sameSite: 'Lax',
    }]);

    const providerPosts: string[] = [];
    page.on('request', browserRequest => {
      if (
        browserRequest.method() === 'POST'
        && /facebook\.com|zalo\.me|zaloapp\.com/i.test(browserRequest.url())
      ) {
        providerPosts.push(browserRequest.url());
      }
    });

    await page.goto(`${BASE_URL}/#/social-publishing`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Xuất bản sản phẩm công khai' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Error Boundary');

    await page.getByRole('combobox', {
      name: 'Chọn sản phẩm đủ điều kiện xuất bản',
    }).click();
    // The dropdown closes on any scroll; force avoids Playwright scrolling
    // the portal option into view before clicking it.
    await page.getByRole('option', { name: /SOCIAL-SMOKE-/ }).click({ force: true });

    await page.locator('[data-social-platform="FACEBOOK_PAGE"] input').check();
    await page.locator('[data-social-platform="ZALO_BROADCAST"] input').check();
    await page.getByRole('button', { name: 'Xem preview' }).click();
    await expect(page.getByText('Preview content')).toBeVisible();
    await expect(page.locator('article')).toHaveCount(2);

    const caption = page.getByLabel('Caption đã duyệt');
    await expect(caption).toHaveValue(/.+/);
    await caption.fill('Authenticated multi-platform smoke caption');
    await page.getByRole('button', { name: 'Lưu draft' }).click();
    await expect(page.getByText('Đã lưu snapshot bất biến vào bản nháp.')).toBeVisible();
    await expect(page.getByText('Social publishing browser smoke listing', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Publication đã lưu' })).toBeVisible();
    await expect(page.getByText('Social publishing browser smoke listing', { exact: true })).toBeVisible();

    const activateResponsePromise = page.waitForResponse(response => (
      response.request().method() === 'POST'
      && response.url().includes('/api/social-publications/')
      && response.url().endsWith('/activate')
    ));
    await page.getByRole('button', { name: 'Đăng ngay' }).click();
    const activateResponse = await activateResponsePromise;
    const activateBody = await activateResponse.json();

    expect(activateResponse.status()).toBe(409);
    expect(activateBody).toMatchObject({
      code: 'PUBLISHERS_NOT_READY',
      targets: expect.arrayContaining([
        expect.objectContaining({ platform: 'FACEBOOK_PAGE', canPublish: false }),
        expect.objectContaining({ platform: 'ZALO_BROADCAST', canPublish: false }),
      ]),
    });
    expect(providerPosts).toEqual([]);

    const publicationId = String(
      (await db!.query(
        `SELECT id FROM social_publications
         WHERE tenant_id = $1 AND listing_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [fixtureTenantId, fixtureListingId],
      )).rows[0].id,
    );
    const publicationState = await db!.query(
      `SELECT p.status AS publication_status, t.platform, t.status, t.attempt_count
       FROM social_publications p
       JOIN social_publication_targets t ON t.publication_id = p.id
       WHERE p.id = $1
       ORDER BY t.platform`,
      [publicationId],
    );
    expect(publicationState.rows).toEqual([
      {
        publication_status: 'DRAFT',
        platform: 'FACEBOOK_PAGE',
        status: 'NOT_READY',
        attempt_count: 0,
      },
      {
        publication_status: 'DRAFT',
        platform: 'ZALO_BROADCAST',
        status: 'NOT_READY',
        attempt_count: 0,
      },
    ]);
  });
});
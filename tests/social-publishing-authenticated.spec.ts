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
  let fixtureImageFilenames: string[] = [];
  let fixtureImageUrls: string[] = [];
  let fixtureEmail = '';
  const fixturePassword = `SocialPublishing-${randomUUID()}`;
  const fixtureImageData = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );

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
    fixtureImageFilenames = Array.from(
      { length: 4 },
      (_, index) => `social-publishing-${index + 1}-${randomUUID()}.png`,
    );
    fixtureImageUrls = fixtureImageFilenames.map(
      filename => `/uploads/${fixtureTenantId}/${filename}`,
    );
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
    for (const filename of fixtureImageFilenames) {
      await db.query(
        `INSERT INTO uploaded_files
          (tenant_id, filename, content_type, data, size)
         VALUES ($1, $2, 'image/png', $3, $4)`,
        [fixtureTenantId, filename, fixtureImageData, fixtureImageData.length],
      );
    }
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
        JSON.stringify(fixtureImageUrls),
        fixtureUserId,
      ],
    );
  });

  test.afterAll(async () => {
    try {
      await db?.query('SET session_replication_role = replica');
      if (db && fixtureTenantId && fixtureImageFilenames.length) {
        await db.query('DELETE FROM uploaded_files WHERE tenant_id = $1 AND filename = ANY($2::text[])', [
          fixtureTenantId,
          fixtureImageFilenames,
        ]);
      }
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
    const draftSaveRequests: Array<Record<string, unknown>> = [];
    page.on('request', browserRequest => {
      if (
        browserRequest.method() === 'POST'
        && /facebook\.com|zalo\.me|zaloapp\.com/i.test(browserRequest.url())
      ) {
        providerPosts.push(browserRequest.url());
      }
      if (
        browserRequest.method() === 'POST'
        && browserRequest.url().includes('/api/social-publications')
        && !browserRequest.url().endsWith('/preview')
      ) {
        draftSaveRequests.push(browserRequest.postDataJSON() as Record<string, unknown>);
      }
    });

    const brokenImages: string[] = [];
    page.on('response', response => {
      if (response.request().resourceType() === 'image' && response.status() >= 400) {
        brokenImages.push(`${response.status()} ${response.url()}`);
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
    await expect(page.locator('article')).toHaveCount(2, { timeout: 15_000 });

    const caption = page.getByLabel('Caption đã duyệt');
    await expect(caption).toHaveValue(/.+/);
    const longCaption = [
      'Authenticated multi-platform smoke caption with a deliberately long review paragraph.',
      'Nội dung này phải tự xuống dòng trong card preview, không làm tràn chiều rộng của giao diện.',
    ].join(' ').repeat(8);
    await caption.fill(longCaption);

    const previewImages = page.locator('article img');
    const thumbnailImages = page.locator('article .grid.grid-cols-4 img');
    await expect(previewImages).toHaveCount(8);
    await expect(thumbnailImages).toHaveCount(6);

    const assertResponsivePreview = async (width: number, height: number) => {
      await page.setViewportSize({ width, height });
      await expect(page.locator('article')).toHaveCount(2);
      await thumbnailImages.last().scrollIntoViewIfNeeded();
      await expect.poll(async () => previewImages.evaluateAll(images => (
        images.every(image => (image as HTMLImageElement).complete
          && (image as HTMLImageElement).naturalWidth > 0)
      ))).toBe(true);
      const layout = await page.evaluate(() => {
        const viewportWidth = window.innerWidth;
        const withinViewport = (element: Element) => {
          const rect = element.getBoundingClientRect();
          return rect.left >= -1
            && rect.right <= viewportWidth + 1
            && element.scrollWidth <= element.clientWidth + 1;
        };
        return {
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          articles: Array.from(document.querySelectorAll('article')).map(withinViewport),
          platforms: Array.from(document.querySelectorAll('[data-social-platform]')).map(withinViewport),
          galleries: Array.from(document.querySelectorAll('article .grid.grid-cols-4')).map(withinViewport),
          galleryImages: Array.from(document.querySelectorAll('article .grid.grid-cols-4 img')).map(withinViewport),
        };
      });
      expect(layout.documentWidth).toBeLessThanOrEqual(width);
      expect(layout.bodyWidth).toBeLessThanOrEqual(width);
      expect(layout.articles).toEqual([true, true]);
      expect(layout.platforms.every(Boolean)).toBe(true);
      expect(layout.galleries).toEqual([true, true]);
      expect(layout.galleryImages).toHaveLength(6);
      expect(layout.galleryImages.every(Boolean)).toBe(true);
      expect(brokenImages).toEqual([]);
      await expect(page.locator('article').first()).toContainText('Facebook Page');
      await expect(page.locator('article').first()).toContainText(longCaption);
      await expect(page.locator('[data-social-platform="FACEBOOK_PAGE"]')).toContainText('Facebook Page');
      await expect(page.locator('[data-social-platform="FACEBOOK_PAGE"]')).toContainText('Chưa sẵn sàng');
      await expect(page.locator('[data-social-platform="ZALO_BROADCAST"]')).toContainText('Zalo OA broadcast/public');
      await expect(page.locator('[data-social-platform="ZALO_BROADCAST"]')).toContainText('Chưa sẵn sàng');
    };

    await assertResponsivePreview(1280, 900);
    await assertResponsivePreview(390, 844);

    const captionBeforeImageFailure = await caption.inputValue();
    const imageOrderBeforeFailure = await page.locator('article').first().locator('img').evaluateAll(
      images => images.map(image => (image as HTMLImageElement).src),
    );
    const firstPreviewImage = page.locator('article').first().locator('img').first();
    await firstPreviewImage.evaluate(image => {
      image.dispatchEvent(new Event('error'));
    });

    await expect(page.getByRole('alert')).toContainText(
      'Không thể lưu draft khi 1 ảnh đã chọn không khả dụng',
    );
    await expect(page.getByRole('button', { name: 'Lưu draft' })).toBeDisabled();
    expect(draftSaveRequests).toEqual([]);

    await page.getByRole('button', { name: 'Thử tải lại' }).first().click();
    await expect(firstPreviewImage).toBeVisible();
    await expect.poll(async () => firstPreviewImage.evaluate(
      image => (image as HTMLImageElement).complete
        && (image as HTMLImageElement).naturalWidth > 0,
    )).toBe(true);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(caption).toHaveValue(captionBeforeImageFailure);
    await expect(page.locator('article').first().locator('img').evaluateAll(
      images => images.map(image => (image as HTMLImageElement).src),
    )).resolves.toEqual(imageOrderBeforeFailure);

    const saveResponsePromise = page.waitForResponse(response => (
      response.request().method() === 'POST'
      && response.url().includes('/api/social-publications')
      && !response.url().endsWith('/preview')
    ));
    await page.getByRole('button', { name: 'Lưu draft' }).click();
    await saveResponsePromise;
    await expect(page.getByText('Đã lưu snapshot bất biến vào bản nháp.')).toBeVisible();
    expect(draftSaveRequests).toHaveLength(1);
    expect(draftSaveRequests[0]).toMatchObject({
      listingId: fixtureListingId,
      platforms: ['FACEBOOK_PAGE', 'ZALO_BROADCAST'],
      caption: captionBeforeImageFailure,
      imageUrls: fixtureImageUrls,
    });
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
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { expect, test } from '@playwright/test';

test.skip(!process.env.AIVEN_DATABASE_URL, 'requires the integration PostgreSQL database');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const HOST_TENANT = '00000000-0000-0000-0000-000000000001';
const PUBLISHED_SLUG = 'du-an-demo-zcode';
const SECTION_STAGES = ['hero', 'gallery', 'legal', 'price', 'amenities', 'contact'];

const DRAFT_VISITOR_KEY = `landing-smoke-${randomUUID()}`;
const DRAFT_SLUG = `landing-smoke-${randomUUID()}`;
const DRAFT_SECTIONS = SECTION_STAGES.map((stage) => ({
  stage,
  title: `${stage} smoke fixture`,
  body: `Nội dung smoke test cho ${stage}.`,
  items: [`Mục ${stage}`],
  tokens: 1,
}));

function databaseConnectionString() {
  return process.env.AIVEN_DATABASE_URL!
    .replace(/[?&](?:sslmode|channel_binding)=[^&]*/gi, '')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');
}

test.describe('Landing builder public route', () => {
  let db: Pool;
  let fixtureInserted = false;

  test.beforeAll(async () => {
    db = new Pool({
      connectionString: databaseConnectionString(),
      ssl: { rejectUnauthorized: false },
    });
    await db.query(
      `INSERT INTO landing_pages
        (tenant_id, visitor_key, project_name, slug, sections, status, tokens_used, language)
       VALUES ($1, $2, $3, $4, $5::jsonb, 'draft', 6, 'vi')`,
      [
        HOST_TENANT,
        DRAFT_VISITOR_KEY,
        'Landing smoke draft',
        DRAFT_SLUG,
        JSON.stringify(DRAFT_SECTIONS),
      ],
    );
    fixtureInserted = true;
  });

  test.afterAll(async () => {
    try {
      if (fixtureInserted) {
        await db?.query(
          'DELETE FROM landing_pages WHERE slug = $1 AND visitor_key = $2',
          [DRAFT_SLUG, DRAFT_VISITOR_KEY],
        );
      }
    } finally {
      await db?.end();
    }
  });

  test.beforeEach(async () => {
    await db.query(
      'UPDATE landing_pages SET status = $1 WHERE slug = $2 AND visitor_key = $3',
      ['draft', DRAFT_SLUG, DRAFT_VISITOR_KEY],
    );
  });

  test('renders the published demo landing with all six sections in order', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/landing/${PUBLISHED_SLUG}`);
    const html = await response.text();

    expect(response?.status()).toBe(200);
    expect(html).toContain('<main class="landing-builder-page">');
    expect(html).toContain('Can ho 12 ha');

    const renderedPositions = SECTION_STAGES.map((stage) => html.indexOf(`id="${stage}"`));
    expect(renderedPositions.every((position) => position >= 0)).toBeTruthy();
    expect(renderedPositions).toEqual([...renderedPositions].sort((a, b) => a - b));
  });

  test('shows the landing-builder CTA for an unknown slug', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/landing/landing-smoke-missing-${randomUUID()}`);
    const html = await response.text();

    expect(response?.status()).toBe(200);
    expect(html).toContain('Không tìm thấy trang landing');
    expect(html).toContain('href="/livechat"');
    expect(html).toContain('Dựng trang landing mới');
  });

  test('hides a draft when the visitor key does not match', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/landing/${DRAFT_SLUG}?visitorKey=wrong-key`);
    const html = await response.text();

    expect(response.status()).toBe(200);
    expect(html).toContain('Không tìm thấy trang landing');
    expect(html).not.toContain('Phát hành trang');
  });

  test('shows an owner draft and its publish action for the matching visitor key', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/landing/${DRAFT_SLUG}?visitorKey=${encodeURIComponent(DRAFT_VISITOR_KEY)}`,
    );
    const html = await response.text();

    expect(response.status()).toBe(200);
    expect(html).toContain('<main class="landing-builder-page">');
    expect(html).toContain('Bản nháp');
    expect(html).toContain('Phát hành trang');
  });

  test('keeps the draft visible after a publish error and retries successfully', async ({ page }) => {
    let publishAttempts = 0;
    await page.route(`**/api/landing-pages/${DRAFT_SLUG}/publish`, async (route) => {
      publishAttempts += 1;
      if (publishAttempts === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Dịch vụ phát hành đang tạm thời gián đoạn.' }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto(
      `${BASE_URL}/landing/${DRAFT_SLUG}?visitorKey=${encodeURIComponent(DRAFT_VISITOR_KEY)}`,
    );

    const publishButton = page.getByRole('button', { name: 'Phát hành trang' });
    await publishButton.click();

    await expect(page.locator('.landing-builder-publish-error')).toContainText(
      'Phát hành chưa thành công: Dịch vụ phát hành đang tạm thời gián đoạn.',
    );
    await expect(page.getByText('Bản nháp')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Phát hành trang' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Landing smoke draft' })).toBeVisible();
    await expect(page.locator('#hero')).toContainText(DRAFT_SECTIONS[0].body);

    await page.getByRole('button', { name: 'Phát hành trang' }).click();

    await expect(page.locator('.landing-builder-publish-error')).toHaveCount(0);
    await expect(page.getByText('Bản nháp')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Phát hành trang' })).toHaveCount(0);
    expect(publishAttempts).toBe(2);
  });

  test('publishes the owner draft and makes all content public', async ({ page }) => {
    await page.goto(
      `${BASE_URL}/landing/${DRAFT_SLUG}?visitorKey=${encodeURIComponent(DRAFT_VISITOR_KEY)}`,
    );

    const publishButton = page.getByRole('button', { name: 'Phát hành trang' });
    await expect(publishButton).toBeVisible();

    const publishRequestPromise = page.waitForRequest((request) => (
      request.method() === 'POST'
      && new URL(request.url()).pathname === `/api/landing-pages/${DRAFT_SLUG}/publish`
    ));
    const publishResponsePromise = page.waitForResponse((response) => (
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === `/api/landing-pages/${DRAFT_SLUG}/publish`
    ));

    await publishButton.click();

    const publishRequest = await publishRequestPromise;
    const publishResponse = await publishResponsePromise;
    expect(publishRequest.postDataJSON()).toEqual({ visitorKey: DRAFT_VISITOR_KEY });
    expect(publishResponse.status()).toBe(200);
    await expect(page.getByRole('button', { name: 'Phát hành trang' })).toHaveCount(0);
    await expect(page.getByText('Bản nháp')).toHaveCount(0);

    const publicResponse = await page.goto(`${BASE_URL}/landing/${DRAFT_SLUG}`);
    expect(publicResponse?.status()).toBe(200);
    await expect(page.locator('main.landing-builder-page')).toBeVisible();
    await expect(page.getByText('Không tìm thấy trang landing')).toHaveCount(0);
    await expect(page.getByText('Bản nháp')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Phát hành trang' })).toHaveCount(0);

    for (const section of DRAFT_SECTIONS) {
      if (section.stage !== 'hero') {
        await expect(page.locator(`#${section.stage}`)).toContainText(section.title);
      }
      await expect(page.locator(`#${section.stage}`)).toContainText(section.body);
    }
  });

  test('uploads, reports rejected gallery files, and removes an image from the editor', async ({ page }) => {
    const uploadedImageUrl = '/uploads/00000000-0000-0000-0000-000000000001/gallery-one.webp';
    const gallerySections = (images: string[]) => DRAFT_SECTIONS.map((section) => (
      section.stage === 'gallery' ? { ...section, images } : section
    ));
    let uploadAttempt = 0;

    await page.route(`**/api/landing-pages/${DRAFT_SLUG}/images`, async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        uploadAttempt += 1;
        if (uploadAttempt === 1) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              page: { sections: gallerySections([uploadedImageUrl]) },
              uploaded: 1,
              rejected: ['rejected.png'],
            }),
          });
          return;
        }

        await route.fulfill({
          status: 415,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Khong co anh hop le nao duoc tai len',
            rejected: ['all-rejected.txt'],
          }),
        });
        return;
      }

      expect(request.method()).toBe('DELETE');
      expect(request.postDataJSON()).toEqual({
        visitorKey: DRAFT_VISITOR_KEY,
        url: uploadedImageUrl,
      });
      expect(request.headers()['x-csrf-token']).toBeTruthy();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page: { sections: gallerySections([]) },
        }),
      });
    });

    await page.goto(
      `${BASE_URL}/landing-ai/chinh-sua/${DRAFT_SLUG}?k=${encodeURIComponent(DRAFT_VISITOR_KEY)}`,
    );

    const uploadRequestPromise = page.waitForRequest((request) => (
      request.method() === 'POST'
      && new URL(request.url()).pathname === `/api/landing-pages/${DRAFT_SLUG}/images`
    ));
    const uploadResponsePromise = page.waitForResponse((response) => (
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === `/api/landing-pages/${DRAFT_SLUG}/images`
    ));

    await page.locator('#project-gallery-images').setInputFiles([
      { name: 'accepted.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('accepted-image') },
      { name: 'rejected.png', mimeType: 'image/png', buffer: Buffer.from('rejected-image') },
    ]);

    const uploadRequest = await uploadRequestPromise;
    const uploadResponse = await uploadResponsePromise;
    const uploadBody = uploadRequest.postData() || '';
    expect(uploadRequest.headers()['x-csrf-token']).toBeTruthy();
    expect(uploadRequest.headers()['cookie']).toContain('csrf_token=');
    expect(uploadBody).toContain(`name="visitorKey"`);
    expect(uploadBody).toContain(DRAFT_VISITOR_KEY);
    expect(uploadBody).toContain('accepted.jpg');
    expect(uploadBody).toContain('rejected.png');
    expect(uploadResponse.status()).toBe(200);
    await expect(page.getByText('Đã tải lên 1 ảnh.')).toBeVisible();
    await expect(page.getByText('Một số file bị từ chối: rejected.png')).toBeVisible();
    await expect(page.locator(`img[src="${uploadedImageUrl}"]`)).toHaveCount(1);

    const rejectedUploadResponsePromise = page.waitForResponse((response) => (
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === `/api/landing-pages/${DRAFT_SLUG}/images`
    ));
    await page.locator('#project-gallery-images').setInputFiles({
      name: 'all-rejected.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not-an-image'),
    });
    const rejectedUploadResponse = await rejectedUploadResponsePromise;
    expect(rejectedUploadResponse.status()).toBe(415);
    await expect(page.getByText('all-rejected.txt')).toBeVisible();
    await expect(page.locator(`img[src="${uploadedImageUrl}"]`)).toHaveCount(1);

    const removeResponsePromise = page.waitForResponse((response) => (
      response.request().method() === 'DELETE'
      && new URL(response.url()).pathname === `/api/landing-pages/${DRAFT_SLUG}/images`
    ));
    await page.getByRole('button', { name: 'Xóa ảnh' }).click();
    const removeResponse = await removeResponsePromise;
    expect(removeResponse.status()).toBe(200);
    await expect(page.locator(`img[src="${uploadedImageUrl}"]`)).toHaveCount(0);
    await expect(page.getByText('Đã xóa ảnh.')).toBeVisible();
  });
});
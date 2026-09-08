import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sgs.vn';
const ADMIN_PASS = process.env.ADMIN_PASS || '';
const CSAT_LEAD_ID = '00000000-0000-0000-0000-000000000361';
const CSAT_LEAD_NAME = 'Khách CSAT smoke';

test.skip(!ADMIN_PASS, 'requires ADMIN_PASS for an authenticated Inbox smoke test');

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
  await expect(page).toHaveURL(/dashboard/);
}

test.describe('Inbox CSAT capture', () => {
  test('records a low score reason through the Inbox form', async ({ page }) => {
    await login(page);

    await page.route('**/api/inbox/threads', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            leadId: CSAT_LEAD_ID,
            leadName: CSAT_LEAD_NAME,
            leadPhone: '0900000361',
            leadAvatar: null,
            leadStage: 'QUALIFIED',
            assignedTo: null,
            assignedToName: null,
            leadScore: null,
            lastMessage: 'Tôi muốn đánh giá lại trải nghiệm hỗ trợ',
            lastChannel: 'WEB',
            lastDirection: 'INBOUND',
            lastTimestamp: '2026-09-08T09:00:00.000Z',
            lastType: 'TEXT',
            unreadCount: 0,
            threadStatus: 'HUMAN_TAKEOVER',
          },
        ]),
      });
    });
    await page.route(`**/api/leads/${CSAT_LEAD_ID}/interactions`, async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'interaction-csat-request-361',
              leadId: CSAT_LEAD_ID,
              content: 'Mời khách đánh giá chất lượng hỗ trợ',
              channel: 'WEB',
              direction: 'OUTBOUND',
              type: 'TEXT',
              timestamp: '2026-09-08T09:01:00.000Z',
              status: 'SENT',
              metadata: { csatRequest: true },
            },
          ]),
        });
        return;
      }
      await route.continue();
    });
    await page.route(`**/api/inbox/threads/${CSAT_LEAD_ID}/read`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Thread marked as read' }),
      });
    });
    await page.route('**/api/users/members**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], total: 0 }),
      });
    });

    const csatRequestPromise = page.waitForRequest(
      request =>
        request.method() === 'POST'
        && new URL(request.url()).pathname === '/api/ai/signals/csat',
    );
    await page.route('**/api/ai/signals/csat', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'signal-csat-361',
          signalType: 'support_csat',
          subjectId: CSAT_LEAD_ID,
          score: 2,
        }),
      });
    });

    await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: CSAT_LEAD_NAME })).toBeVisible();
    await page.getByRole('button', { name: CSAT_LEAD_NAME }).click();

    const lowScoreButton = page.getByRole('button', { name: '2', exact: true });
    await expect(lowScoreButton).toBeVisible();
    await lowScoreButton.click();

    const reasonInput = page.getByRole('textbox', { name: 'Lý do CSAT thấp' });
    await expect(reasonInput).toBeVisible();
    await expect(reasonInput).toHaveAttribute('maxlength', '500');

    await reasonInput.fill('x'.repeat(501));
    await expect(reasonInput).toHaveValue('x'.repeat(500));
    await reasonInput.fill('Phản hồi chậm và chưa giải thích rõ hướng xử lý.');
    await page.getByRole('checkbox', { name: 'Khách đã đồng ý ghi nhận đánh giá này' }).check();

    await page.getByRole('button', { name: 'Ghi nhận CSAT' }).click();

    const csatRequest = await csatRequestPromise;
    expect(csatRequest.postDataJSON()).toMatchObject({
      subjectId: CSAT_LEAD_ID,
      score: 2,
      channel: 'WEB',
      consent: true,
      reason: 'Phản hồi chậm và chưa giải thích rõ hướng xử lý.',
    });
    await expect(page.getByText('Đã ghi nhận CSAT 2/5 cho hội thoại này.')).toBeVisible();
  });
});
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
    await expect(page.getByLabel('Nội dung tin nhắn')).toBeVisible({ timeout: 30_000 });

    const leadBeforeReload = await db.query(
      `SELECT id, name, phone, email, source, metadata
       FROM leads
       WHERE id = $1
         AND tenant_id = $2`,
      [firstLeadBody.id, HOST_TENANT],
    );
    expect(leadBeforeReload.rows).toHaveLength(1);
    expect(leadBeforeReload.rows[0].name).toBe('Live chat authenticated fixture');
    expect([null, '']).toContain(leadBeforeReload.rows[0].phone);
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

  test('isolates status polling from message writes in the public API', async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);

    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: fixtureEmail, password: fixturePassword },
    });
    expect(loginResponse.status()).toBe(200);
    const loginBody = await loginResponse.json();

    await page.context().addCookies([
      {
        name: 'token',
        value: loginBody.token,
        url: BASE_URL,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    // Use a request-scoped forwarded IP so this proof remains isolated from
    // other browser tests, regardless of whether the server uses Redis or the
    // in-memory fallback store.
    const testIp = `livechat-status-isolation-${randomUUID()}`;
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': testIp });

    const firstLeadResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/public/leads') &&
        response.request().method() === 'POST',
    );
    await page.goto(`${BASE_URL}/livechat`, { waitUntil: 'domcontentloaded' });
    const firstLead = await firstLeadResponse;
    expect(firstLead.status()).toBe(201);
    const leadId = String((await firstLead.json()).id || '');
    expect(leadId).toMatch(/^[0-9a-f-]{36}$/i);

    const initialText = `status limiter baseline ${randomUUID()}`;
    const followUpText = `status limiter follow-up ${randomUUID()}`;
    const sendMessage = (content: string, idempotencyKey: string) =>
      request.post(`${BASE_URL}/api/public/livechat/message`, {
        headers: { 'x-forwarded-for': testIp },
        data: {
          leadId,
          content,
          direction: 'INBOUND',
          idempotencyKey,
        },
      });

    const initialMessage = await sendMessage(initialText, `status-isolation:${randomUUID()}`);
    expect(initialMessage.status()).toBe(201);

    const countMessages = async () => {
      const result = await db.query(
        `SELECT COUNT(*)::int AS count
         FROM interactions
         WHERE tenant_id = $1 AND lead_id = $2`,
        [HOST_TENANT, leadId],
      );
      return Number(result.rows[0].count);
    };
    const countAfterInitialMessage = await countMessages();

    const statusUrl = `${BASE_URL}/api/public/ai/livechat/status/${leadId}/${randomUUID()}`;
    const statusResponses = await Promise.all(
      Array.from({ length: 31 }, () =>
        request.get(statusUrl, {
          headers: { 'x-forwarded-for': testIp },
        }),
      ),
    );
    const limitedStatusResponses = statusResponses.filter(
      (response) => response.status() === 429,
    );
    expect(limitedStatusResponses).toHaveLength(1);
    for (const statusResponse of statusResponses) {
      if (statusResponse.status() === 429) continue;
      // The status handler may return a transient 503 when its read is
      // contending for the database; that still proves the request passed the
      // dedicated limiter rather than consuming the message bucket.
      expect([200, 503]).toContain(statusResponse.status());
    }

    const limitedStatus = limitedStatusResponses[0];
    expect(limitedStatus.status()).toBe(429);
    const retryAfter = Number(limitedStatus.headers()['retry-after']);
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThan(0);
    await expect(limitedStatus.json()).resolves.toMatchObject({
      retryAfter: expect.any(Number),
    });

    // A rejected status read is read-only and must not alter the saved
    // conversation.
    expect(await countMessages()).toBe(countAfterInitialMessage);

    const followUpMessage = await sendMessage(
      followUpText,
      `status-isolation:${randomUUID()}`,
    );
    expect(followUpMessage.status()).toBe(201);
    expect(await countMessages()).toBe(countAfterInitialMessage + 1);
  });

  test('keeps a slow 202 reply recoverable without duplicate messages', async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);

    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: fixtureEmail, password: fixturePassword },
    });
    expect(loginResponse.status()).toBe(200);
    const loginBody = await loginResponse.json();

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
    const messageBox = page.getByLabel('Nội dung tin nhắn');
    await expect(messageBox).toBeVisible({ timeout: 30_000 });

    const pendingText = `smoke pending reconcile ${randomUUID()}`;
    const assistantText = `SMOKE_PENDING_REPLY_${randomUUID()}`;
    let pendingRequestBody: Record<string, any> | null = null;
    let pendingAiCalls = 0;
    let messageHistoryReadsAfterPending = 0;
    let statusCalls = 0;
    const statusCallTimes: number[] = [];
    let historyReadAfterSuccess = false;

    await page.route('**/api/public/ai/livechat', async (route) => {
      const body = route.request().postDataJSON() as Record<string, any>;
      if (body.message !== pendingText) return route.continue();

      pendingAiCalls += 1;
      pendingRequestBody = body;
      expect(typeof body.requestId).toBe('string');
      expect(body.requestId.length).toBeGreaterThan(10);

      // Simulate the durable worker completing after the public AI request has
      // crossed its acknowledgement deadline. The widget receives 202 first,
      // then recovers this committed assistant row from message history.
      const outboundResponse = await request.post(`${BASE_URL}/api/public/livechat/message`, {
        data: {
          leadId: body.leadId,
          content: assistantText,
          direction: 'OUTBOUND',
          metadata: { isAgent: true, isAi: true },
          idempotencyKey: `pending-smoke-outbound:${body.requestId}`,
        },
      });
      expect(outboundResponse.status()).toBe(201);

      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          async: true,
          status: 'PROCESSING',
          code: 'AI_ASYNC_PROCESSING',
          inboundInteractionId: body.inboundInteractionId,
        }),
      });
    });

    await page.route('**/api/public/ai/livechat/status/*/*', async (route) => {
      statusCalls += 1;
      statusCallTimes.push(Date.now());
      if (statusCalls === 1) {
        return route.fulfill({
          status: 429,
          contentType: 'application/json',
          headers: { 'Retry-After': '2' },
          body: JSON.stringify({
            error: 'Bạn đang kiểm tra trạng thái quá nhanh.',
            code: 'LIVECHAT_STATUS_RATE_LIMITED',
            retryAfter: 2,
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          statusCalls === 2
            ? { status: 'PROCESSING', code: 'AI_ASYNC_PROCESSING', retryAfter: 1 }
            : { status: 'SUCCESS', code: 'SUCCESS' },
        ),
      });
    });

    await page.route('**/api/public/livechat/messages/*', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      messageHistoryReadsAfterPending += 1;
      if (statusCalls >= 2) {
        historyReadAfterSuccess = true;
        // A contended history read must not turn an already accepted run into
        // a false send error while the assistant row is being recovered.
        await new Promise((resolve) => setTimeout(resolve, 1_200));
      }
      return route.continue();
    });

    const aiResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/public/ai/livechat') &&
        response.request().method() === 'POST',
    );
    await messageBox.fill(pendingText);
    await messageBox.press('Enter');
    const aiResponse = await aiResponsePromise;
    expect(aiResponse.status()).toBe(202);
    const aiResponseBody = await aiResponse.json();
    expect(aiResponseBody).toMatchObject({
      async: true,
      status: 'PROCESSING',
      code: 'AI_ASYNC_PROCESSING',
    });
    expect(aiResponseBody.inboundInteractionId).toBe(pendingRequestBody!.inboundInteractionId);

    await expect(page.locator('[aria-live="polite"]')).toContainText(assistantText, {
      timeout: 15_000,
    });
    await expect(page.getByText('Không gửi được tin nhắn. Vui lòng thử lại hoặc gọi 0379 281 445.')).toHaveCount(0);

    expect(pendingAiCalls).toBe(1);
    expect(statusCalls).toBeGreaterThanOrEqual(3);
    expect(statusCallTimes[1] - statusCallTimes[0]).toBeGreaterThanOrEqual(1_800);
    expect(statusCallTimes[2] - statusCallTimes[1]).toBeGreaterThanOrEqual(1_400);
    // A 429 and a subsequent PROCESSING response must not fall through to
    // full history reconciliation. There is only one read after SUCCESS.
    expect(messageHistoryReadsAfterPending).toBe(1);
    expect(historyReadAfterSuccess).toBe(true);
    expect(pendingRequestBody).not.toBeNull();

    const inboundRows = await db.query(
      `SELECT id, external_event_id
       FROM interactions
       WHERE tenant_id = $1 AND lead_id = (
         SELECT id FROM leads
         WHERE tenant_id = $1
           AND metadata->>'authenticated_user_id' = $2
         ORDER BY created_at DESC
         LIMIT 1
       )
       AND direction = 'INBOUND' AND content = $3`,
      [HOST_TENANT, fixtureUserId, pendingText],
    );
    expect(inboundRows.rows).toHaveLength(1);
    expect(inboundRows.rows[0].external_event_id).toBe(
      `web-inbound:${pendingRequestBody!.requestId}`,
    );

    const outboundRows = await db.query(
      `SELECT id
       FROM interactions
       WHERE tenant_id = $1 AND content = $2 AND direction = 'OUTBOUND'`,
      [HOST_TENANT, assistantText],
    );
    expect(outboundRows.rows).toHaveLength(1);
  });

  test('keeps the saved inbound visible when a pending provider run fails', async ({
    page,
    request,
  }) => {
    test.setTimeout(45_000);

    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: fixtureEmail, password: fixturePassword },
    });
    expect(loginResponse.status()).toBe(200);
    const loginBody = await loginResponse.json();

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
    const messageBox = page.getByLabel('Nội dung tin nhắn');
    await expect(messageBox).toBeVisible({ timeout: 30_000 });

    const timeoutText = `smoke provider timeout ${randomUUID()}`;
    let timeoutRequestBody: Record<string, any> | null = null;
    let pendingAiCalls = 0;
    let statusCalls = 0;

    await page.route('**/api/public/ai/livechat', async (route) => {
      const body = route.request().postDataJSON() as Record<string, any>;
      if (body.message !== timeoutText) return route.continue();

      pendingAiCalls += 1;
      timeoutRequestBody = body;
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          async: true,
          status: 'PROCESSING',
          code: 'AI_ASYNC_PROCESSING',
          inboundInteractionId: body.inboundInteractionId,
        }),
      });
    });

    await page.route('**/api/public/ai/livechat/status/*/*', async (route) => {
      statusCalls += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          statusCalls === 1
            ? { status: 'PROCESSING', code: 'AI_ASYNC_PROCESSING', retryAfter: 3 }
            : { status: 'FAILED', code: 'AI_PROVIDER_TIMEOUT', retryAfter: 5 },
        ),
      });
    });

    const aiResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/public/ai/livechat') &&
        response.request().method() === 'POST',
    );
    await messageBox.fill(timeoutText);
    await messageBox.press('Enter');
    const aiResponse = await aiResponsePromise;
    expect(aiResponse.status()).toBe(202);

    await expect(page.getByText(timeoutText)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('div[role="alert"]').filter({ hasText: 'Minh chưa thể hoàn tất phản hồi lúc này' })).toContainText(
      'Minh chưa thể hoàn tất phản hồi lúc này. Tin nhắn đã được lưu',
      { timeout: 10_000 },
    );
    await expect(page.getByText('Không gửi được tin nhắn. Vui lòng thử lại hoặc gọi 0379 281 445.')).toHaveCount(0);

    expect(pendingAiCalls).toBe(1);
    expect(statusCalls).toBeGreaterThanOrEqual(2);
    expect(timeoutRequestBody).not.toBeNull();

    const inboundRows = await db.query(
      `SELECT id, external_event_id
       FROM interactions
       WHERE tenant_id = $1 AND lead_id = (
         SELECT id FROM leads
         WHERE tenant_id = $1
           AND metadata->>'authenticated_user_id' = $2
         ORDER BY created_at DESC
         LIMIT 1
       )
       AND direction = 'INBOUND' AND content = $3`,
      [HOST_TENANT, fixtureUserId, timeoutText],
    );
    expect(inboundRows.rows).toHaveLength(1);
    expect(inboundRows.rows[0].external_event_id).toBe(
      `web-inbound:${timeoutRequestBody!.requestId}`,
    );
  });
});

import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { Pool } from 'pg';
import { expect, test, type Page } from '@playwright/test';

const require = createRequire(import.meta.url);
const SOCKET_IO_BROWSER_BUNDLE = require.resolve('socket.io-client/dist/socket.io.js');
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

function databaseConnectionString(): string {
  return DATABASE_URL!
    .replace(/[?&](?:sslmode|channel_binding)=[^&]*/gi, '')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');
}

type BrowserResponse = {
  status: number;
  body: any;
};

async function browserJson(
  page: Page,
  endpoint: string,
  init: { method?: string; body?: string; headers?: Record<string, string> } = {},
): Promise<BrowserResponse> {
  return page.evaluate(
    async ({
      endpoint: requestEndpoint,
      init: requestInit,
    }: {
      endpoint: string;
      init: { method?: string; body?: string; headers?: Record<string, string> };
    }) => {
      const response = await fetch(requestEndpoint, {
        ...requestInit,
        headers: {
          ...(requestInit.headers || {}),
          ...(requestInit.method && requestInit.method !== 'GET'
            ? {
                'X-CSRF-Token': (await (await fetch('/api/csrf-token', {
                  credentials: 'include',
                })).json()).csrfToken,
              }
            : {}),
        },
        credentials: 'include',
      });
      const raw = await response.text();
      let body: any = raw;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        // Preserve non-JSON proxy responses for a useful assertion failure.
      }
      return { status: response.status, body };
    },
    { endpoint, init },
  );
}

function postJson(
  page: Page,
  path: string,
  data: Record<string, unknown>,
): Promise<BrowserResponse> {
  return browserJson(page, `${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  });
}

async function uploadText(
  page: any,
  leadId: string,
  text: string,
): Promise<BrowserResponse> {
  return page.evaluate(
    async ({
      endpoint,
      leadId: requestLeadId,
      text: fileText,
    }: { endpoint: string; leadId: string; text: string }) => {
      const form = new FormData();
      form.append('leadId', requestLeadId);
      form.append(
        'files',
        new Blob([fileText], { type: 'text/plain' }),
        `fixture-${requestLeadId}.txt`,
      );
      const csrfResponse = await fetch('/api/csrf-token', { credentials: 'include' });
      const csrfBody = await csrfResponse.json();
      const response = await fetch(endpoint, {
        method: 'POST',
        body: form,
        headers: { 'X-CSRF-Token': csrfBody.csrfToken },
        credentials: 'include',
      });
      const raw = await response.text();
      let body: any = raw;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        // Preserve non-JSON proxy responses for assertion diagnostics.
      }
      return { status: response.status, body };
    },
    {
      endpoint: `${BASE_URL}/api/public/livechat/attachments`,
      leadId,
      text,
    },
  );
}

async function selectCapability(page: any, cookie: any): Promise<void> {
  await page.context().clearCookies();
  await page.context().addCookies([cookie]);
}

async function waitForSocket(
  page: any,
  key: string,
): Promise<void> {
  await expect
    .poll(
      () => page.evaluate(
        (socketKey: string) => Boolean((window as any).__liveChatSmoke?.[socketKey]?.state?.connected),
        key,
      ),
      { timeout: 20_000, intervals: [100, 250, 500] },
    )
    .toBe(true);
}

test.describe('Public live-chat capability through the preview proxy', () => {
  test.setTimeout(360_000);

  let db: Pool;
  const fixtureLeadIds: string[] = [];
  const uploadedFileIds: string[] = [];

  test.beforeAll(async () => {
    db = new Pool({
      connectionString: databaseConnectionString(),
      max: 1,
      connectionTimeoutMillis: 15_000,
      ssl: { rejectUnauthorized: false },
    });
  });

  test.afterAll(async () => {
    try {
      if (uploadedFileIds.length > 0) {
        await db.query(
          `DELETE FROM uploaded_files
            WHERE tenant_id = $1 AND filename = ANY($2::text[])`,
          [HOST_TENANT, uploadedFileIds],
        );
      }
      if (fixtureLeadIds.length > 0) {
        await db.query(
          `DELETE FROM landing_pages WHERE visitor_key = ANY($1::text[])`,
          [fixtureLeadIds],
        );
        await db.query(
          `DELETE FROM leads WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
          [HOST_TENANT, fixtureLeadIds],
        );
      }
    } finally {
      await db?.end();
    }
  });

  test('isolates two browser capabilities across history, uploads, rooms, status, and retries', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/livechat?source=CAPABILITY_SMOKE`, {
      waitUntil: 'domcontentloaded',
    });

    const createLead = async (label: string): Promise<string> => {
      let response: BrowserResponse | undefined;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        response = await postJson(page, '/api/public/leads', {
          name: `Capability smoke ${label}`,
          phone: `090${randomUUID().replace(/\D/g, '').slice(0, 8).padEnd(8, '7')}`,
          source: 'CAPABILITY_SMOKE',
        });
        if (response.status !== 500) break;
        await page.waitForTimeout(2_000);
      }
      if (!response) throw new Error('lead creation did not produce a response');
      expect(response.status).toBe(201);
      expect(response.body?.id).toMatch(/^[0-9a-f-]{36}$/i);
      fixtureLeadIds.push(response.body.id);
      return response.body.id;
    };

    const leadA = await createLead('A');
    const cookiesAfterA = await page.context().cookies(BASE_URL);
    const capabilityA = cookiesAfterA.find((cookie) =>
      cookie.name.startsWith('sgs_minh_livechat_'),
    );
    expect(capabilityA).toBeTruthy();

    const leadB = await createLead('B');
    const cookiesAfterB = await page.context().cookies(BASE_URL);
    const capabilityB = cookiesAfterB.find((cookie) =>
      cookie.name.startsWith('sgs_minh_livechat_') && cookie.name !== capabilityA!.name,
    );
    expect(capabilityB).toBeTruthy();

    await selectCapability(page, capabilityA);
    const ownHistoryA = await browserJson(
      page,
      `${BASE_URL}/api/public/livechat/messages/${leadA}`,
    );
    expect(ownHistoryA.status).toBe(200);
    expect(ownHistoryA.body?.lead?.id).toBe(leadA);

    const crossHistoryFromA = await browserJson(
      page,
      `${BASE_URL}/api/public/livechat/messages/${leadB}`,
    );
    expect(crossHistoryFromA.status).toBe(403);
    expect(crossHistoryFromA.body?.code).toBe('LIVECHAT_CAPABILITY_REQUIRED');

    const ownUploadA = await uploadText(page, leadA, `capability A ${randomUUID()}`);
    expect(ownUploadA.status).toBe(201);
    expect(ownUploadA.body?.attachments).toHaveLength(1);
    uploadedFileIds.push(String(ownUploadA.body.attachments[0].id));

    const crossUploadFromA = await uploadText(page, leadB, 'cross-lead upload');
    expect(crossUploadFromA.status).toBe(403);
    expect(crossUploadFromA.body?.code).toBe('LIVECHAT_CAPABILITY_REQUIRED');

    const crossStatusFromA = await browserJson(
      page,
      `${BASE_URL}/api/public/ai/livechat/status/${leadB}/${randomUUID()}`,
    );
    expect(crossStatusFromA.status).toBe(403);
    expect(crossStatusFromA.body?.code).toBe('LIVECHAT_CAPABILITY_REQUIRED');

    const outboundSpoof = await postJson(page, '/api/public/livechat/message', {
      leadId: leadA,
      content: 'client supplied outbound direction',
      direction: 'OUTBOUND',
      idempotencyKey: `capability-outbound:${randomUUID()}`,
    });
    expect(outboundSpoof.status).toBe(400);
    expect(outboundSpoof.body?.code).toBe('LIVECHAT_DIRECTION_FORBIDDEN');

    const fabricatedAttachment = await postJson(page, '/api/public/livechat/message', {
      leadId: leadA,
      content: 'fabricated attachment',
      metadata: {
        attachments: [{
          id: 'fabricated.txt',
          name: 'fabricated.txt',
          kind: 'document',
          mimeType: 'text/plain',
          size: 12,
          contentHash: '0'.repeat(64),
          textHash: '0'.repeat(64),
          proof: 'fabricated-proof',
        }],
      },
      idempotencyKey: `capability-attachment:${randomUUID()}`,
    });
    expect(fabricatedAttachment.status).toBe(400);
    expect(fabricatedAttachment.body?.code).toBe('LIVECHAT_ATTACHMENT_PROVENANCE_INVALID');

    await page.addScriptTag({ path: SOCKET_IO_BROWSER_BUNDLE });
    await page.evaluate(
      ({ leadA: ownLead, leadB: otherLead }) => {
        const socket = (window as any).io(window.location.origin, {
          path: '/socket.io',
          addTrailingSlash: false,
          transports: ['polling'],
          withCredentials: true,
          reconnection: false,
        });
        const state = { connected: false, leadIds: [] as string[] };
        socket.on('connect', () => {
          state.connected = true;
          socket.emit('join_livechat_room', ownLead);
          socket.emit('join_livechat_room', otherLead);
        });
        socket.on('receive_message', (event: any) => {
          const leadId = event?.message?.leadId || event?.message?.lead_id;
          if (typeof leadId === 'string') state.leadIds.push(leadId);
        });
        (window as any).__liveChatSmoke = {
          ...(window as any).__liveChatSmoke,
          socketA: { socket, state },
        };
      },
      { leadA, leadB },
    );
    await waitForSocket(page, 'socketA');

    const inboundA = await postJson(page, '/api/public/livechat/message', {
      leadId: leadA,
      content: `capability A inbound ${randomUUID()}`,
      idempotencyKey: `capability-inbound-a:${randomUUID()}`,
    });
    expect(inboundA.status).toBe(201);

    await expect
      .poll(
        () => page.evaluate(() => (window as any).__liveChatSmoke.socketA.state.leadIds),
        { timeout: 10_000 },
      )
      .toContain(leadA);
    await expect
      .poll(
        () => page.evaluate(() => (window as any).__liveChatSmoke.socketA.state.leadIds),
        { timeout: 1_500, intervals: [250] },
      )
      .not.toContain(leadB);

    await selectCapability(page, capabilityB);
    const ownHistoryB = await browserJson(
      page,
      `${BASE_URL}/api/public/livechat/messages/${leadB}`,
    );
    expect(ownHistoryB.status).toBe(200);
    expect(ownHistoryB.body?.lead?.id).toBe(leadB);

    const crossHistoryFromB = await browserJson(
      page,
      `${BASE_URL}/api/public/livechat/messages/${leadA}`,
    );
    expect(crossHistoryFromB.status).toBe(403);
    expect(crossHistoryFromB.body?.code).toBe('LIVECHAT_CAPABILITY_REQUIRED');

    const ownUploadB = await uploadText(page, leadB, `capability B ${randomUUID()}`);
    expect(ownUploadB.status).toBe(201);
    expect(ownUploadB.body?.attachments).toHaveLength(1);
    uploadedFileIds.push(String(ownUploadB.body.attachments[0].id));

    const crossUploadFromB = await uploadText(page, leadA, 'cross-lead upload');
    expect(crossUploadFromB.status).toBe(403);
    expect(crossUploadFromB.body?.code).toBe('LIVECHAT_CAPABILITY_REQUIRED');

    const ownStatusWithoutRunB = await browserJson(
      page,
      `${BASE_URL}/api/public/ai/livechat/status/${leadB}/${randomUUID()}`,
    );
    expect(ownStatusWithoutRunB.status).toBe(200);
    expect(ownStatusWithoutRunB.body?.status).toBe('NOT_FOUND');

    await page.evaluate(
      ({ leadA: ownLead, leadB: otherLead }) => {
        const socket = (window as any).io(window.location.origin, {
          path: '/socket.io',
          addTrailingSlash: false,
          transports: ['polling'],
          withCredentials: true,
          reconnection: false,
        });
        const state = { connected: false, leadIds: [] as string[] };
        socket.on('connect', () => {
          state.connected = true;
          socket.emit('join_livechat_room', ownLead);
          socket.emit('join_livechat_room', otherLead);
        });
        socket.on('receive_message', (event: any) => {
          const leadId = event?.message?.leadId || event?.message?.lead_id;
          if (typeof leadId === 'string') state.leadIds.push(leadId);
        });
        (window as any).__liveChatSmoke.socketB = { socket, state };
      },
      { leadA, leadB },
    );
    await waitForSocket(page, 'socketB');

    const inboundB = await postJson(page, '/api/public/livechat/message', {
      leadId: leadB,
      content: `capability B inbound ${randomUUID()}`,
      idempotencyKey: `capability-inbound-b:${randomUUID()}`,
    });
    expect(inboundB.status).toBe(201);
    await expect
      .poll(
        () => page.evaluate(() => (window as any).__liveChatSmoke.socketB.state.leadIds),
        { timeout: 10_000 },
      )
      .toContain(leadB);
    await expect
      .poll(
        () => page.evaluate(() => (window as any).__liveChatSmoke.socketB.state.leadIds),
        { timeout: 1_500, intervals: [250] },
      )
      .not.toContain(leadA);

    await selectCapability(page, capabilityA);
    const retryText = `public capability retry ${randomUUID()}`;
    const savedInbound = await postJson(page, '/api/public/livechat/message', {
      leadId: leadA,
      content: retryText,
      idempotencyKey: `capability-retry-message:${randomUUID()}`,
    });
    expect(savedInbound.status).toBe(201);
    const inboundInteractionId = savedInbound.body?.message?.id;
    expect(inboundInteractionId).toMatch(/^[0-9a-f-]{36}$/i);

    const aiBody = {
      leadId: leadA,
      message: retryText,
      inboundInteractionId,
      requestId: `capability-ai:${randomUUID()}`,
    };
    const [original, retry] = await page.evaluate(
      async ({ endpoint, body }) => {
        const requests = [body, { ...body, retry: true, requestId: `${body.requestId}:retry` }];
        return Promise.all(
          requests.map(async (requestBody) => {
            const response = await fetch(endpoint, {
              method: 'POST',
              credentials: 'include',
              headers: {
                'content-type': 'application/json',
                'X-CSRF-Token': (await (await fetch('/api/csrf-token', {
                  credentials: 'include',
                })).json()).csrfToken,
              },
              body: JSON.stringify(requestBody),
            });
            const raw = await response.text();
            let parsed: any = raw;
            try {
              parsed = raw ? JSON.parse(raw) : null;
            } catch {
              // Preserve non-JSON proxy responses for diagnostics.
            }
            return { status: response.status, body: parsed };
          }),
        );
      },
      { endpoint: `${BASE_URL}/api/public/ai/livechat`, body: aiBody },
    );
    expect([200, 202, 503]).toContain(original.status);
    expect([200, 202, 503]).toContain(retry.status);
    expect(original.body?.inboundInteractionId || original.body?.reply).toBeTruthy();
    expect(retry.body?.inboundInteractionId || retry.body?.reply).toBeTruthy();

    const statusResults: any[] = [];
    const statusDeadline = Date.now() + 60_000;
    while (Date.now() < statusDeadline) {
      const statusResponse = await browserJson(
        page,
        `${BASE_URL}/api/public/ai/livechat/status/${leadA}/${inboundInteractionId}`,
      );
      expect([200, 503]).toContain(statusResponse.status);
      expect(statusResponse.body?.status).not.toBe('NOT_FOUND');
      statusResults.push(statusResponse.body?.status);
      if (statusResponse.body?.status !== 'PROCESSING') break;
      await page.waitForTimeout(1_000);
    }
    expect(statusResults.length).toBeGreaterThan(0);
    expect(statusResults).not.toContain('NOT_FOUND');

    await expect
      .poll(
        async () => {
          const result = await db.query(
            `SELECT COUNT(*)::int AS count
               FROM agent_executions
              WHERE tenant_id = $1 AND lead_id = $2 AND idempotency_key = $3`,
            [HOST_TENANT, leadA, `web:${inboundInteractionId}`],
          );
          return Number(result.rows[0]?.count || 0);
        },
        { timeout: 60_000, intervals: [500, 1_000, 2_000] },
      )
      .toBe(1);

    await page.evaluate(() => {
      const sockets = (window as any).__liveChatSmoke || {};
      sockets.socketA?.socket.disconnect();
      sockets.socketB?.socket.disconnect();
    });
  });
});
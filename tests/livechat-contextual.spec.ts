import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { expect, test } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const HOST_TENANT = '00000000-0000-0000-0000-000000000001';
const DATABASE_URL = process.env.AIVEN_DATABASE_URL;
const RUN_CONTEXT_SMOKE = process.env.RUN_LIVECHAT_CONTEXT_SMOKE === '1';

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
  !RUN_CONTEXT_SMOKE || !hasUsableDatabaseUrl(DATABASE_URL),
  'set RUN_LIVECHAT_CONTEXT_SMOKE=1 and provide AIVEN_DATABASE_URL to run the live AI smoke',
);

function databaseConnectionString() {
  return DATABASE_URL!
    .replace(/[?&](?:sslmode|channel_binding)=[^&]*/gi, '')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');
}

type ExecutionRow = {
  id: string;
  status: string;
  input_json: Record<string, any>;
  output_json: Record<string, any> | null;
};

type InteractionRow = {
  id: string;
  direction: string;
  content: string;
  metadata: Record<string, any> | null;
};

async function waitForExecution(
  db: Pool,
  leadId: string,
  inboundInteractionId: string,
): Promise<ExecutionRow> {
  await expect
    .poll(
      async () => {
        const result = await db.query<ExecutionRow>(
          `SELECT id, status, input_json, output_json
             FROM agent_executions
            WHERE tenant_id = $1
              AND lead_id = $2
              AND idempotency_key = $3
            LIMIT 1`,
          [HOST_TENANT, leadId, `web:${inboundInteractionId}`],
        );
        return result.rows[0]?.status || null;
      },
      { timeout: 240_000, intervals: [1_000, 2_000, 5_000] },
    )
    .toBe('SUCCESS');

  const result = await db.query<ExecutionRow>(
    `SELECT id, status, input_json, output_json
       FROM agent_executions
      WHERE tenant_id = $1
        AND lead_id = $2
        AND idempotency_key = $3
      LIMIT 1`,
    [HOST_TENANT, leadId, `web:${inboundInteractionId}`],
  );
  expect(result.rows[0]).toBeTruthy();
  return result.rows[0];
}

async function waitForInbound(
  db: Pool,
  leadId: string,
  content: string,
): Promise<InteractionRow> {
  await expect
    .poll(
      async () => {
        const result = await db.query<InteractionRow>(
          `SELECT id, direction, content, metadata
             FROM interactions
            WHERE tenant_id = $1
              AND lead_id = $2
              AND direction = 'INBOUND'
              AND content = $3
            ORDER BY timestamp DESC
            LIMIT 1`,
          [HOST_TENANT, leadId, content],
        );
        return result.rows[0]?.id || null;
      },
      { timeout: 30_000, intervals: [250, 500, 1_000] },
    )
    .not.toBeNull();

  const result = await db.query<InteractionRow>(
    `SELECT id, direction, content, metadata
       FROM interactions
      WHERE tenant_id = $1
        AND lead_id = $2
        AND direction = 'INBOUND'
        AND content = $3
      ORDER BY timestamp DESC
      LIMIT 1`,
    [HOST_TENANT, leadId, content],
  );
  return result.rows[0];
}

async function readMessages(db: Pool, leadId: string): Promise<InteractionRow[]> {
  const result = await db.query<InteractionRow>(
    `SELECT id, direction, content, metadata
       FROM interactions
      WHERE tenant_id = $1 AND lead_id = $2
      ORDER BY timestamp ASC`,
    [HOST_TENANT, leadId],
  );
  return result.rows;
}

test.describe('Public live-chat contextual follow-up', () => {
  test.setTimeout(600_000);

  let db: Pool;
  let socket: Socket | null = null;
  const fixtureLeadIds: string[] = [];
  const finishedRunEvents: Array<Record<string, any>> = [];
  const assistantSocketMessages: Array<Record<string, any>> = [];

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
      if (fixtureLeadIds.length) {
        await db.query(
          `DELETE FROM agent_executions
            WHERE tenant_id = $1 AND lead_id = ANY($2::uuid[])`,
          [HOST_TENANT, fixtureLeadIds],
        );
        await db.query(
          `DELETE FROM interactions
            WHERE tenant_id = $1 AND lead_id = ANY($2::uuid[])`,
          [HOST_TENANT, fixtureLeadIds],
        );
        await db.query(
          `DELETE FROM leads
            WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
          [HOST_TENANT, fixtureLeadIds],
        );
      }
    } finally {
      socket?.disconnect();
      await db?.end();
    }
  });

  test('keeps the latest project topic for a short follow-up and dedupes retry/reconnect', async ({
    page,
    request,
  }) => {
    const firstQuestion = 'Dự án MCC nằm ở đâu và có những tiện ích nào?';
    const shortFollowUp = 'mấy giờ?';
    const newQuestion = 'Pháp lý dự án Izumi có những điểm nào cần lưu ý?';

    await page.goto(`${BASE_URL}/livechat?source=CONTEXT_SMOKE`, {
      waitUntil: 'domcontentloaded',
    });
    await page.getByLabel('Họ và tên').fill(`Context smoke ${randomUUID().slice(0, 8)}`);
    await page.getByLabel('Số điện thoại').fill('0900000000');

    const leadResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/public/leads') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Bắt đầu chat với Minh' }).click();
    const leadBody = await (await leadResponse).json();
    const leadId = String(leadBody.id || '');
    expect(leadId).toMatch(/^[0-9a-f-]{36}$/i);
    fixtureLeadIds.push(leadId);

    const input = page.getByLabel('Nội dung tin nhắn');
    await expect(input).toBeVisible({ timeout: 30_000 });

    socket = io(BASE_URL, {
      path: '/socket.io',
      addTrailingSlash: false,
      transports: ['polling'],
      withCredentials: true,
      reconnection: false,
      timeout: 20_000,
    });
    socket.on('agent_run_finished', (event) => {
      if (event?.leadId === leadId) finishedRunEvents.push(event);
    });
    socket.on('receive_message', (event) => {
      const message = event?.message || event;
      if (
        message?.leadId === leadId &&
        message?.direction === 'OUTBOUND' &&
        message?.metadata?.isAgent === true
      ) {
        assistantSocketMessages.push(message);
      }
    });
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Socket.IO did not connect')), 20_000);
      socket!.once('connect', () => {
        clearTimeout(timeout);
        socket!.emit('join_livechat_room', leadId);
        resolve();
      });
      socket!.once('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    await input.fill(firstQuestion);
    await input.press('Enter');
    await expect(page.locator('[aria-live="polite"]')).toContainText(firstQuestion);

    const firstInbound = await waitForInbound(db, leadId, firstQuestion);
    const firstExecution = await waitForExecution(db, leadId, firstInbound.id);
    const firstResult = firstExecution.output_json?.result || {};
    expect(firstResult.intent).toBe('PROJECT');
    expect(firstResult.executedTools).toContain('get_project_info');
    expect(JSON.stringify(firstResult.specialistOutput).toLowerCase()).toContain('mcc');
    await expect(page.locator('[aria-live="polite"]')).toContainText(
      String(firstResult.content || firstResult.response || '').slice(0, 60),
      { timeout: 30_000 },
    );

    await expect(input).toBeEnabled({ timeout: 30_000 });
    await input.fill(shortFollowUp);
    await input.press('Enter');
    await expect(page.locator('[aria-live="polite"]')).toContainText(shortFollowUp);

    const secondInbound = await waitForInbound(db, leadId, shortFollowUp);
    const secondExecution = await waitForExecution(db, leadId, secondInbound.id);
    const secondResult = secondExecution.output_json?.result || {};
    expect(secondExecution.input_json.message).toBe(shortFollowUp);
    expect(secondResult.intent).toBe('PROJECT');
    expect(secondResult.executedTools).toContain('get_project_info');
    expect(JSON.stringify(secondResult.specialistOutput).toLowerCase()).toContain('mcc');

    const secondSteps = await db.query(
      `SELECT step_key, input_json
         FROM agent_execution_steps
        WHERE tenant_id = $1 AND execution_id = $2
        ORDER BY created_at ASC`,
      [HOST_TENANT, secondExecution.id],
    );
    const projectStep = secondSteps.rows.find((row) =>
      String(row.step_key).includes('get_project_info'),
    );
    expect(projectStep).toBeTruthy();
    expect(JSON.stringify(projectStep.input_json)).toContain(firstQuestion);
    expect(JSON.stringify(projectStep.input_json)).toContain(shortFollowUp);

    await expect(input).toBeEnabled({ timeout: 30_000 });
    await input.fill(newQuestion);
    await input.press('Enter');
    await expect(page.locator('[aria-live="polite"]')).toContainText(newQuestion);

    const thirdInbound = await waitForInbound(db, leadId, newQuestion);
    const thirdExecution = await waitForExecution(db, leadId, thirdInbound.id);
    const thirdResult = thirdExecution.output_json?.result || {};
    expect(thirdExecution.input_json.message).toBe(newQuestion);
    expect(thirdResult.intent).toBe('LEGAL');
    expect(thirdResult.executedTools).toContain('legal_qa');

    const thirdSteps = await db.query(
      `SELECT step_key, input_json
         FROM agent_execution_steps
        WHERE tenant_id = $1 AND execution_id = $2
        ORDER BY created_at ASC`,
      [HOST_TENANT, thirdExecution.id],
    );
    const legalStep = thirdSteps.rows.find((row) => String(row.step_key).includes('legal_qa'));
    expect(legalStep).toBeTruthy();
    expect(JSON.stringify(legalStep.input_json)).toContain(newQuestion);
    expect(JSON.stringify(legalStep.input_json)).not.toContain(firstQuestion);

    const secondAssistantCount = async () => {
      const messages = await readMessages(db, leadId);
      return messages.filter(
        (message) =>
          message.direction === 'OUTBOUND' &&
          message.metadata?.isAgent === true &&
          message.metadata?.inboundInteractionId === secondInbound.id,
      ).length;
    };

    const retryResponse = await request.post(`${BASE_URL}/api/public/ai/livechat`, {
      data: {
        leadId,
        message: shortFollowUp,
        inboundInteractionId: secondInbound.id,
        requestId: `context-retry:${randomUUID()}`,
      },
    });
    expect([200, 202]).toContain(retryResponse.status());
    const retryBody = await retryResponse.json();
    if (retryResponse.status() === 200) {
      expect(retryBody.reply).toBeTruthy();
    } else {
      expect(retryBody).toMatchObject({
        async: true,
        code: 'AI_ASYNC_PROCESSING',
        inboundInteractionId: secondInbound.id,
      });
    }
    await expect.poll(secondAssistantCount, { timeout: 30_000 }).toBe(1);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Nội dung tin nhắn')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(shortFollowUp, { exact: true })).toHaveCount(1);
    await new Promise((resolve) => setTimeout(resolve, 1_000));

    expect(
      assistantSocketMessages.filter(
        (message) => message.metadata?.inboundInteractionId === secondInbound.id,
      ),
    ).toHaveLength(1);
    expect(
      finishedRunEvents.filter(
        (event) => event.inboundInteractionId === secondInbound.id,
      ),
    ).toHaveLength(1);
    await expect.poll(secondAssistantCount).toBe(1);
  });
});
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { createPublicLiveChatCapability } from '../services/publicLiveChatCapability';
import { DEFAULT_TENANT_ID } from '../constants';

// A real server restart includes migrations and worker startup. Keep this
// process-level regression independent from the repository-wide 30s default.
vi.setConfig({ testTimeout: 180_000, hookTimeout: 240_000 });

const integrationUrl = process.env.AIVEN_DATABASE_URL || process.env.INTEGRITY_PG_URL;
const describeEntrypoint = integrationUrl ? describe : describe.skip;
const baseConnectionString = integrationUrl?.replace(
  /([?&])(?:sslmode|channel_binding)=[^&]*/g,
  '$1',
).replace(/[?&]$/, '');

const tenantB = randomUUID();
const leadA = randomUUID();
const leadB = randomUUID();
const inboundA = randomUUID();
const inboundB = randomUUID();
const executionA = randomUUID();
const executionB = randomUUID();
const jwtSecret = `live-chat-reply-outbox-restart-${randomUUID()}`;
const tsxCli = path.resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs');
const serverEntrypoint = path.resolve(process.cwd(), 'server.ts');

type RunningProcess = {
  child: ChildProcess;
  output: () => string;
};

function startBackend(port: number): RunningProcess {
  const child = spawn(process.execPath, [tsxCli, serverEntrypoint], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AIVEN_DATABASE_URL: baseConnectionString,
      JWT_SECRET: jwtSecret,
      SESSION_SECRET: jwtSecret,
      NODE_ENV: 'development',
      PORT: String(port),
      DB_POOL_MAX: '8',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout?.on('data', chunk => { output += String(chunk); });
  child.stderr?.on('data', chunk => { output += String(chunk); });
  return { child, output: () => output };
}

async function findFreePort(): Promise<number> {
  const probe = net.createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => resolve());
  });
  const address = probe.address();
  if (!address || typeof address === 'string') {
    probe.close();
    throw new Error('Could not allocate a test port');
  }
  const port = address.port;
  await new Promise<void>((resolve, reject) => {
    probe.close(error => error ? reject(error) : resolve());
  });
  return port;
}

async function waitForHttp(
  url: string,
  processRef: RunningProcess,
  label: string,
): Promise<void> {
  const deadline = Date.now() + 60_000;
  let lastError = 'not attempted';
  while (Date.now() < deadline) {
    if (processRef.child.exitCode !== null) {
      throw new Error(`${label} exited with ${processRef.child.exitCode}:\n${processRef.output()}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.status < 500) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`${label} did not become ready (${lastError}):\n${processRef.output()}`);
}

async function stopBackend(processRef: RunningProcess | undefined): Promise<void> {
  if (!processRef || processRef.child.exitCode !== null) return;
  processRef.child.kill('SIGTERM');
  await new Promise<void>(resolve => {
    const timer = setTimeout(() => {
      processRef.child.kill('SIGKILL');
      resolve();
    }, 10_000);
    processRef.child.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function json(response: Response): Promise<Record<string, any>> {
  return response.json() as Promise<Record<string, any>>;
}

describeEntrypoint('live-chat reply outbox survives a backend restart', () => {
  let db: Pool;
  let backend: RunningProcess | undefined;
  let port: number;
  let fixtureReady = false;
  const previousSessionSecret = process.env.SESSION_SECRET;

  const capabilityA = () => createPublicLiveChatCapability({
    leadId: leadA,
    tenantId: DEFAULT_TENANT_ID,
  });
  const capabilityB = () => createPublicLiveChatCapability({
    leadId: leadB,
    tenantId: tenantB,
  });

  async function query(text: string, values: unknown[] = []) {
    return db.query(text, values);
  }

  async function status(
    leadId: string,
    inboundInteractionId: string,
    capability: string,
  ): Promise<{ response: Response; body: Record<string, any> }> {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/public/ai/livechat/status/${leadId}/${inboundInteractionId}`,
      { headers: { 'X-Minh-Chat-Capability': capability } },
    );
    return { response, body: await json(response) };
  }

  async function history(
    leadId: string,
    capability: string,
  ): Promise<{ response: Response; body: Record<string, any> }> {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/public/livechat/messages/${leadId}`,
      { headers: { 'X-Minh-Chat-Capability': capability } },
    );
    return { response, body: await json(response) };
  }

  async function waitForStatus(
    leadId: string,
    inboundInteractionId: string,
    capability: string,
  ): Promise<{ response: Response; body: Record<string, any> }> {
    const deadline = Date.now() + 45_000;
    let last: { response: Response; body: Record<string, any> } | undefined;
    while (Date.now() < deadline) {
      last = await status(leadId, inboundInteractionId, capability);
      if (last.response.status !== 503) return last;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return last!;
  }

  beforeAll(async () => {
    // The child backend intentionally gets an isolated secret. Sign the
    // capability used by this test with the same value.
    process.env.SESSION_SECRET = jwtSecret;
    db = new Pool({
      connectionString: baseConnectionString,
      max: 1,
      connectionTimeoutMillis: 10_000,
      ssl: { rejectUnauthorized: false },
    });
    await query('SELECT 1');

    await query(
      `INSERT INTO tenants (id, name, domain)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [tenantB, `Live-chat restart isolation ${tenantB}`, `live-chat-restart-${tenantB}`],
    );
    await query(
      `INSERT INTO leads (id, tenant_id, name, phone)
       VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
      [
        leadA, DEFAULT_TENANT_ID, 'Restart visitor A', '0900000001',
        leadB, tenantB, 'Restart visitor B', '0900000002',
      ],
    );
    await query(
      `INSERT INTO interactions
        (id, tenant_id, lead_id, channel, direction, type, content, metadata, external_event_id)
       VALUES
        ($1, $2, $3, 'WEB', 'INBOUND', 'TEXT', $4, '{}'::jsonb, $5),
        ($6, $7, $8, 'WEB', 'INBOUND', 'TEXT', $9, '{}'::jsonb, $10)`,
      [
        inboundA, DEFAULT_TENANT_ID, leadA, 'Giá căn hộ sau khi backend restart?', `restart-inbound:${inboundA}`,
        inboundB, tenantB, leadB, 'Tenant B private message', `restart-inbound:${inboundB}`,
      ],
    );
    await query(
      `INSERT INTO agent_executions
        (id, tenant_id, idempotency_key, lead_id, agent_name, trigger_source,
         status, current_step, output_json, finished_at)
       VALUES
        ($1, $2, $3, $4, 'SGS_AGENT', 'public-livechat', 'SUCCESS', 'SYNTHESIZE',
         $5::jsonb, NOW()),
        ($6, $7, $8, $9, 'SGS_AGENT', 'public-livechat', 'SUCCESS', 'SYNTHESIZE',
         '{}'::jsonb, NOW())`,
      [
        executionA, DEFAULT_TENANT_ID, `web:${inboundA}`, leadA,
        JSON.stringify({ result: { content: 'Đây là câu trả lời đã lưu trước khi restart.' } }),
        executionB, tenantB, `web:${inboundB}`, leadB,
      ],
    );

    // This is the exact crash window: the accepted run has its complete
    // response envelope, but no outbound interaction has been persisted.
    const responseEnvelope = {
      content: 'Đây là câu trả lời đã lưu trước khi restart.',
      reply: 'Đây là câu trả lời đã lưu trước khi restart.',
      sources: [{ title: 'Bảng giá SGS', url: '/data/prices' }],
      artifact: { type: 'listing', id: 'listing-before-restart' },
      suggestedAction: 'VIEW_LISTING',
      intent: 'PRICE_LOOKUP',
      clarificationReason: null,
      missingData: [],
      clarificationRequired: false,
      confidence: 0.94,
      degraded: false,
      degradedReason: null,
      providerOutcome: 'PRIMARY',
      runId: executionA,
      traceId: randomUUID(),
      inboundInteractionId: inboundA,
    };
    await query(
      `INSERT INTO livechat_reply_outbox
        (tenant_id, lead_id, inbound_interaction_id, execution_id, status, response_json)
       VALUES
        ($1, $2, $3, $4, 'REPLY_PENDING', $5::jsonb),
        ($6, $7, $8, $9, 'REPLY_PENDING', $10::jsonb)`,
      [
        DEFAULT_TENANT_ID, leadA, inboundA, executionA, JSON.stringify(responseEnvelope),
        tenantB, leadB, inboundB, executionB, JSON.stringify({ content: 'Tenant B secret' }),
      ],
    );

    const outboundBeforeRestart = await query(
      `SELECT count(*)::int AS count
         FROM interactions
        WHERE tenant_id = $1 AND lead_id = $2 AND direction = 'OUTBOUND'`,
      [DEFAULT_TENANT_ID, leadA],
    );
    expect(outboundBeforeRestart.rows[0].count).toBe(0);

    port = await findFreePort();
    backend = startBackend(port);
    await waitForHttp(`http://127.0.0.1:${port}/health`, backend, 'first backend');
    fixtureReady = true;
  }, 120_000);

  afterAll(async () => {
    await stopBackend(backend);
    try {
      if (!fixtureReady) return;
      await query('DELETE FROM livechat_reply_outbox WHERE tenant_id IN ($1, $2)', [
        DEFAULT_TENANT_ID,
        tenantB,
      ]);
      await query('DELETE FROM agent_executions WHERE id IN ($1, $2)', [executionA, executionB]);
      await query('DELETE FROM interactions WHERE id IN ($1, $2)', [inboundA, inboundB]);
      await query('DELETE FROM leads WHERE id IN ($1, $2)', [leadA, leadB]);
      await query('DELETE FROM tenants WHERE id = $1', [tenantB]);
    } finally {
      await db?.end();
      if (previousSessionSecret === undefined) {
        delete process.env.SESSION_SECRET;
      } else {
        process.env.SESSION_SECRET = previousSessionSecret;
      }
    }
  });

  it('reconciles the complete pending envelope after restart without creating a duplicate reply', async () => {
    const beforeRestart = await waitForStatus(leadA, inboundA, capabilityA());
    expect(
      beforeRestart.response.status,
      `${JSON.stringify(beforeRestart.body)}\n${backend?.output() || ''}`,
    ).toBe(200);
    expect(beforeRestart.body).toMatchObject({
      status: 'REPLY_PENDING',
      code: 'REPLY_PENDING',
      runId: executionA,
    });

    await stopBackend(backend);
    backend = startBackend(port);
    await waitForHttp(`http://127.0.0.1:${port}/health`, backend, 'restarted backend');

    const afterRestart = await waitForStatus(leadA, inboundA, capabilityA());
    expect(afterRestart.response.status).toBe(200);
    expect(afterRestart.body).toMatchObject({
      status: 'REPLY_PENDING',
      code: 'REPLY_PENDING',
      runId: executionA,
      response: {
        content: 'Đây là câu trả lời đã lưu trước khi restart.',
        reply: 'Đây là câu trả lời đã lưu trước khi restart.',
        sources: [{ title: 'Bảng giá SGS', url: '/data/prices' }],
        artifact: { type: 'listing', id: 'listing-before-restart' },
        suggestedAction: 'VIEW_LISTING',
        intent: 'PRICE_LOOKUP',
        confidence: 0.94,
        providerOutcome: 'PRIMARY',
        inboundInteractionId: inboundA,
      },
    });
    expect(afterRestart.body.response).toEqual(
      expect.objectContaining({
        clarificationReason: null,
        missingData: [],
        clarificationRequired: false,
        degraded: false,
      }),
    );

    const restoredHistory = await history(leadA, capabilityA());
    expect(restoredHistory.response.status).toBe(200);
    expect(restoredHistory.body.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: inboundA, direction: 'INBOUND' }),
      ]),
    );
    expect(
      restoredHistory.body.messages.filter(
        (message: any) => message.direction === 'OUTBOUND',
      ),
    ).toHaveLength(0);

    const outboundAfterRestart = await query(
      `SELECT count(*)::int AS count
         FROM interactions
        WHERE tenant_id = $1 AND lead_id = $2 AND direction = 'OUTBOUND'`,
      [DEFAULT_TENANT_ID, leadA],
    );
    expect(outboundAfterRestart.rows[0].count).toBe(0);
  });

  it('does not let a capability from another tenant read the pending envelope', async () => {
    const crossTenant = await status(leadB, inboundB, capabilityB());
    expect(crossTenant.response.status).toBe(403);
    expect(crossTenant.body).toMatchObject({
      code: 'LIVECHAT_CAPABILITY_REQUIRED',
    });

    const tenantBState = await query(
      `SELECT status, response_json
         FROM livechat_reply_outbox
        WHERE tenant_id = $1 AND inbound_interaction_id = $2`,
      [tenantB, inboundB],
    );
    expect(tenantBState.rows[0]).toMatchObject({
      status: 'REPLY_PENDING',
      response_json: { content: 'Tenant B secret' },
    });
  });
});
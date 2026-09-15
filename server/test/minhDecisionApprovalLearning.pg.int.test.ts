import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { request as httpRequest, type Server } from 'node:http';
import migration149 from '../migrations/149_agent_operating_system';
import migration157 from '../migrations/157_agent_memory_and_signals';
import migration123 from '../migrations/123_approval_requests';
import migration202 from '../migrations/202_minh_proactive_decision_queue';
import migration203 from '../migrations/203_minh_proactive_signal_id_text';
import migration204 from '../migrations/204_minh_decision_learning_rollout';

const integrationUrl = process.env.INTEGRITY_PG_URL || process.env.AIVEN_DATABASE_URL;
const describePostgres = integrationUrl ? describe : describe.skip;
const baseConnectionString = integrationUrl?.replace(
  /([?&])(?:sslmode|channel_binding)=[^&]*/g,
  '$1',
).replace(/[?&]$/, '');
const useSsl = process.env.INTEGRITY_PG_SSL !== 'false';

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const staffA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const staffB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

type TestResponse = { status: number; body: any; text: string };

describePostgres('authenticated Minh approval-to-learning flow', () => {
  let setupPool: Pool;
  let setupClient: PoolClient;
  let appPool: typeof import('../db').pool;
  let app: express.Express;
  let server: Server;
  let origin: { port: number };
  let approvalRequestRepository: typeof import('../repositories/approvalRequestRepository').approvalRequestRepository;
  let getMinhDecisionLearning: typeof import('../services/minhDecisionLearningService').getMinhDecisionLearning;
  let getMinhDecisionLearningTrend: typeof import('../services/minhDecisionLearningService').getMinhDecisionLearningTrend;
  let createMinhBrainRoutes: typeof import('../routes/minhBrainRoutes').createMinhBrainRoutes;
  let schema: string;
  const previousDatabaseUrl = process.env.AIVEN_DATABASE_URL;
  const previousDbRole = process.env.APP_DB_ROLE;
  const jwtSecret = process.env.JWT_SECRET || 'minh-decision-learning-integration-test';

  function connectionWithSchema(): string {
    const separator = baseConnectionString!.includes('?') ? '&' : '?';
    const options = encodeURIComponent(`-c search_path="${schema}",public`);
    return `${baseConnectionString}${separator}options=${options}`;
  }

  async function query(text: string, values?: unknown[]) {
    return setupClient.query(text, values);
  }

  function authCookie(userId: string, tenantId: string): string {
    return `token=${jwt.sign({ id: userId, tenantId, role: 'ADMIN' }, jwtSecret)}`;
  }

  function send(
    path: string,
    options: { method?: string; cookie: string; body?: unknown },
  ): Promise<TestResponse> {
    return new Promise((resolve, reject) => {
      const body = options.body === undefined ? undefined : JSON.stringify(options.body);
      const request = httpRequest({
        hostname: '127.0.0.1',
        port: origin.port,
        path,
        method: options.method || 'GET',
        headers: {
          cookie: options.cookie,
          ...(body ? {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(body),
          } : {}),
        },
      }, response => {
        const chunks: Buffer[] = [];
        response.on('data', chunk => chunks.push(Buffer.from(chunk)));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let body: any = null;
          try { body = JSON.parse(text); } catch { /* keep non-JSON response text */ }
          resolve({ status: response.statusCode || 0, body, text });
        });
      });
      request.on('error', reject);
      if (body) request.write(body);
      request.end();
    });
  }

  async function createSignalAndApproval(
    tenantId: string,
    sourceSignalId: string,
    actionType: 'REVIEW_LISTING_PRICE' | 'REVIEW_CSAT_DROP' = 'REVIEW_LISTING_PRICE',
  ) {
    await query(
      `INSERT INTO agent_signals
        (id, tenant_id, signal_type, actor_id, subject_type, subject_id, payload)
       VALUES ($1,$2,'proactive_opportunity','minh','listing',$3,$4)`,
      [
        sourceSignalId,
        tenantId,
        `${tenantId}-subject`,
        JSON.stringify({ kind: actionType === 'REVIEW_CSAT_DROP' ? 'csat_drop' : 'price_drift' }),
      ],
    );
    return approvalRequestRepository.createProactive({
      tenantId,
      actionType,
      sourceSignalId,
      subjectType: 'listing',
      subjectId: `${tenantId}-subject`,
      payload: {
        sourceSignalId,
        subjectType: 'listing',
        subjectId: `${tenantId}-subject`,
        evidence: { source: 'integration-test' },
      },
      reasoning: 'Disposable tenant-scoped signal for approval learning smoke coverage',
    }, 20);
  }

  beforeAll(async () => {
    schema = `minh_decision_learning_${process.pid}_${Date.now()}`;
    setupPool = new Pool({
      connectionString: baseConnectionString,
      max: 2,
      connectionTimeoutMillis: 10_000,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
    setupClient = await setupPool.connect();
    await setupClient.query(`CREATE SCHEMA "${schema}"`);
    await setupClient.query(`SET search_path TO "${schema}", public`);
    await query(`
      CREATE TABLE tenants (id UUID PRIMARY KEY);
      CREATE TABLE marketing_growth_capabilities (
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        capability_key TEXT NOT NULL,
        role TEXT NOT NULL,
        cadence TEXT NOT NULL,
        rollout TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        UNIQUE (tenant_id, capability_key)
      );
    `);
    await query('INSERT INTO tenants (id) VALUES ($1), ($2)', [tenantA, tenantB]);
    await migration157.up(setupClient);
    await migration149.up(setupClient);
    await migration123.up(setupClient);
    await migration202.up(setupClient);
    await migration203.up(setupClient);
    await query(`
      ALTER TABLE approval_requests
        ADD COLUMN IF NOT EXISTS execution_id UUID,
        ADD COLUMN IF NOT EXISTS step_key TEXT,
        ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
        ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 minutes',
        ADD COLUMN IF NOT EXISTS resumed_at TIMESTAMPTZ;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_approval_requests_idempotency
        ON approval_requests (tenant_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL;
    `);
    await migration204.up(setupClient);
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sgs_app') THEN
          CREATE ROLE sgs_app NOLOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT;
        END IF;
      END $$;
    `);
    await query('GRANT sgs_app TO CURRENT_USER');
    await query(`GRANT USAGE ON SCHEMA "${schema}" TO sgs_app`);
    await query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "${schema}" TO sgs_app`);
    await query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "${schema}" TO sgs_app`);

    process.env.AIVEN_DATABASE_URL = connectionWithSchema();
    process.env.APP_DB_ROLE = 'sgs_app';
    ({ pool: appPool } = await import('../db'));
    ({ approvalRequestRepository } = await import('../repositories/approvalRequestRepository'));
    ({ getMinhDecisionLearning } = await import('../services/minhDecisionLearningService'));
    ({ getMinhDecisionLearningTrend } = await import('../services/minhDecisionLearningService'));
    const { createApprovalRequestRoutes } = await import('../routes/approvalRequestRoutes');
    const { createAgentOperatingRoutes } = await import('../routes/agentOperatingRoutes');
    ({ createMinhBrainRoutes } = await import('../routes/minhBrainRoutes'));

    app = express();
    app.use(express.json());
    app.use(cookieParser());
    const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const token = req.cookies?.token;
      if (!token) return res.status(401).json({ error: 'Unauthorized' });
      jwt.verify(token, jwtSecret, (error: jwt.VerifyErrors | null, user: jwt.JwtPayload | string | undefined) => {
        if (error || !user) return res.status(403).json({ error: 'Forbidden' });
        (req as any).user = user;
        next();
      });
    };
    app.use('/api/approval-requests', createApprovalRequestRoutes(authenticateToken));
    app.use('/api/agent-operating', createAgentOperatingRoutes(authenticateToken));
    app.use('/api/internal/minh-brain', createMinhBrainRoutes(authenticateToken));
    server = app.listen(0);
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not expose a TCP port');
    origin = address;
  });

  afterAll(async () => {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    await appPool?.end();
    setupClient?.release();
    await setupPool?.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await setupPool?.end();
    if (previousDatabaseUrl === undefined) delete process.env.AIVEN_DATABASE_URL;
    else process.env.AIVEN_DATABASE_URL = previousDatabaseUrl;
    if (previousDbRole === undefined) delete process.env.APP_DB_ROLE;
    else process.env.APP_DB_ROLE = previousDbRole;
  });

  it('records tenant-scoped approval, rejection, and answered outcomes without raw answers', async () => {
    const signalA = `smoke-a-${randomUUID()}`;
    const approvalA = await createSignalAndApproval(tenantA, signalA);
    const approved = await send(`/api/approval-requests/${approvalA.id}/approve`, {
      method: 'POST',
      cookie: authCookie(staffA, tenantA),
    });
    expect(approved.status).toBe(200);
    expect(approved.body.result).toMatchObject({
      actionType: 'REVIEW_LISTING_PRICE',
      providerCalled: false,
      mutation: 'NONE',
      executed: true,
    });
    const humanQuestionId = approved.body.result.humanQuestionId;
    expect(humanQuestionId).toMatch(/^[0-9a-f-]{36}$/);

    const repeatedApproval = await send(`/api/approval-requests/${approvalA.id}/approve`, {
      method: 'POST',
      cookie: authCookie(staffA, tenantA),
    });
    expect(repeatedApproval.status).toBe(404);

    const signalB = `smoke-b-${randomUUID()}`;
    const approvalB = await createSignalAndApproval(tenantB, signalB, 'REVIEW_CSAT_DROP');
    const crossTenantReject = await send(`/api/approval-requests/${approvalB.id}/reject`, {
      method: 'POST',
      cookie: authCookie(staffA, tenantA),
      body: { note: 'must not cross tenant boundary' },
    });
    expect(crossTenantReject.status).toBe(404);
    const rejected = await send(`/api/approval-requests/${approvalB.id}/reject`, {
      method: 'POST',
      cookie: authCookie(staffB, tenantB),
      body: { note: 'not this tenant' },
    });
    expect(rejected.status).toBe(200);
    const repeatedRejection = await send(`/api/approval-requests/${approvalB.id}/reject`, {
      method: 'POST',
      cookie: authCookie(staffB, tenantB),
    });
    expect(repeatedRejection.status).toBe(404);

    const rawAnswer = `private answer ${randomUUID()}`;
    const crossTenantAnswer = await send(`/api/agent-operating/questions/${humanQuestionId}/answer`, {
      method: 'POST',
      cookie: authCookie(staffB, tenantB),
      body: { answer: 'tenant B must not answer tenant A question' },
    });
    expect(crossTenantAnswer.status).toBe(404);
    const answered = await send(`/api/agent-operating/questions/${humanQuestionId}/answer`, {
      method: 'POST',
      cookie: authCookie(staffA, tenantA),
      body: { answer: rawAnswer, approveMemory: true },
    });
    expect(answered.status).toBe(200);
    expect(answered.body).toMatchObject({ id: humanQuestionId, status: 'ANSWERED', answer: rawAnswer });
    const repeatedAnswer = await send(`/api/agent-operating/questions/${humanQuestionId}/answer`, {
      method: 'POST',
      cookie: authCookie(staffA, tenantA),
      body: { answer: `${rawAnswer} repeated` },
    });
    expect(repeatedAnswer.status).toBe(404);

    const manualApprovalId = randomUUID();
    await query(
      `INSERT INTO approval_requests
        (id, tenant_id, channel, action_type, payload, reasoning, expires_at)
       VALUES ($1,$2,'MANUAL','REVIEW_REPAIR_SPIKE',$3::jsonb,'non-Minh approval',$4)`,
      [manualApprovalId, tenantA, JSON.stringify({ pattern: 'manual-review' }), new Date(Date.now() + 60_000)],
    );
    const rejectedManualApproval = await send(`/api/approval-requests/${manualApprovalId}/reject`, {
      method: 'POST',
      cookie: authCookie(staffA, tenantA),
    });
    expect(rejectedManualApproval.status).toBe(200);

    const ledgerA = (await query(
      `SELECT tenant_id, source_signal_id, action_type, outcome, feedback_category, metadata_json::text AS metadata
         FROM minh_decision_feedback WHERE tenant_id=$1 ORDER BY outcome`,
      [tenantA],
    )).rows;
    expect(ledgerA).toHaveLength(3);
    expect(ledgerA.map(row => [row.outcome, row.feedback_category])).toEqual([
      ['ANSWERED', 'MEMORY_APPROVED'],
      ['APPROVED', 'OPERATOR_APPROVED'],
      ['EXECUTED', 'NO_PROVIDER_SIDE_EFFECT'],
    ]);
    expect(ledgerA.every(row => row.tenant_id === tenantA && row.source_signal_id === signalA)).toBe(true);
    expect(JSON.stringify(ledgerA)).not.toContain(rawAnswer);

    const ledgerB = (await query(
      `SELECT tenant_id, source_signal_id, action_type, outcome, feedback_category
         FROM minh_decision_feedback WHERE tenant_id=$1`,
      [tenantB],
    )).rows;
    expect(ledgerB).toEqual([expect.objectContaining({
      tenant_id: tenantB,
      source_signal_id: signalB,
      action_type: 'REVIEW_CSAT_DROP',
      outcome: 'REJECTED',
      feedback_category: 'OPERATOR_REJECTED',
    })]);
    expect(await query(
      'SELECT COUNT(*)::int AS count FROM minh_decision_feedback WHERE tenant_id=$1 AND source_signal_id=$2',
      [tenantA, signalB],
    ).then(result => result.rows[0].count)).toBe(0);

    await query(
      `INSERT INTO minh_decision_feedback
        (tenant_id, event_key, action_type, outcome, feedback_category, created_at)
       VALUES ($1, $2, 'OLD_EVENT', 'REJECTED', 'OPERATOR_REJECTED', NOW() - INTERVAL '8 days')`,
      [tenantA, `old-event-${randomUUID()}`],
    );

    const learningA = await getMinhDecisionLearning(tenantA, 7);
    expect(learningA.totals).toMatchObject({
      total: 3,
      approved: 1,
      rejected: 0,
      executed: 1,
      answered: 1,
    });
    expect(learningA.byOutcome).toEqual([
      { outcome: 'ANSWERED', count: 1 },
      { outcome: 'APPROVED', count: 1 },
      { outcome: 'EXECUTED', count: 1 },
    ]);
    expect(learningA.byCategory).toEqual([
      { category: 'MEMORY_APPROVED', count: 1 },
      { category: 'NO_PROVIDER_SIDE_EFFECT', count: 1 },
      { category: 'OPERATOR_APPROVED', count: 1 },
    ]);
    expect(learningA.rawPayloadIncluded).toBe(false);
    expect(learningA.rawAnswerIncluded).toBe(false);
    expect(learningA.providerPayloadIncluded).toBe(false);

    const widerLearningA = await getMinhDecisionLearning(tenantA, 90);
    expect(widerLearningA.totals.total).toBe(4);
    expect(widerLearningA.byOutcome).toEqual([
      { outcome: 'ANSWERED', count: 1 },
      { outcome: 'APPROVED', count: 1 },
      { outcome: 'EXECUTED', count: 1 },
      { outcome: 'REJECTED', count: 1 },
    ]);

    await query(
      `INSERT INTO minh_decision_feedback
        (tenant_id, event_key, action_type, outcome, feedback_category, created_at)
       VALUES ($1, $2, 'REVIEW_LISTING_PRICE', 'REJECTED', 'OPERATOR_REJECTED', NOW() - INTERVAL '2 days')`,
      [tenantA, `trend-event-${randomUUID()}`],
    );
    const trendA = await getMinhDecisionLearningTrend(tenantA, 7);
    expect(trendA).toMatchObject({
      windowDays: 7,
      granularity: 'day',
      empty: false,
      rawPayloadIncluded: false,
      rawAnswerIncluded: false,
      providerPayloadIncluded: false,
    });
    expect(trendA.points.reduce((total, point) => total + point.total, 0)).toBe(4);
    expect(trendA.points.some(point => point.rejected === 1)).toBe(true);
    expect(JSON.stringify(trendA)).not.toContain('private answer');

    const trendB = await getMinhDecisionLearningTrend(tenantB, 7);
    expect(trendB.points.reduce((total, point) => total + point.total, 0)).toBe(1);

    const boundedTrend = await send('/api/internal/minh-brain/learning/trends?days=999', {
      cookie: authCookie(staffA, tenantA),
    });
    expect(boundedTrend.status).toBe(200);
    expect(boundedTrend.body).toMatchObject({
      degraded: false,
      trend: { windowDays: 90, granularity: 'day', empty: false },
    });
  });
});
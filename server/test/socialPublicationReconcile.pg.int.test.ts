import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import migration186 from '../migrations/186_social_publications';
import migration187 from '../migrations/187_social_publication_audit';
import migration190 from '../migrations/190_auto_posting_phase3';
import {
  applySocialTargetOperatorAction,
  createSocialPublication,
  findSocialPublication,
  listSocialPublications,
} from '../repositories/socialPublicationRepository';
import { createSocialPublicationRouter } from '../routes/socialPublicationRoutes';

const integrationUrl = process.env.INTEGRITY_PG_URL;
const describePostgres = integrationUrl ? describe : describe.skip;
const baseConnectionString = integrationUrl?.replace(
  /([?&])(?:sslmode|channel_binding)=[^&]*/g,
  '$1',
).replace(/[?&]$/, '');
const useSsl = process.env.INTEGRITY_PG_SSL !== 'false';

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const actorA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const actorB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describePostgres('social publication reconciliation against PostgreSQL', () => {
  let setupPool: Pool;
  let setupClient: PoolClient | undefined;
  let workerA: Pool;
  let workerB: Pool;
  let httpPool: Pool;
  let httpServer: ReturnType<express.Application['listen']>;
  let httpBaseUrl: string;
  let schema: string;

  function connectionWithSchema(): string {
    const separator = baseConnectionString!.includes('?') ? '&' : '?';
    const options = encodeURIComponent(`-c search_path="${schema}",public`);
    return `${baseConnectionString}${separator}options=${options}`;
  }

  async function query(text: string, values?: unknown[]) {
    return setupPool.query(text, values);
  }

  async function createFixture(tenantId = tenantA, listingTenantId = tenantId) {
    const listingId = randomUUID();
    await query(
      `INSERT INTO listings (id, tenant_id, status, code, title)
       VALUES ($1, $2, 'AVAILABLE', $3, $4)`,
      [listingId, listingTenantId, `fixture-${listingId}`, `Listing ${listingId}`],
    );

    const publication = await createSocialPublication(setupPool, {
      tenantId,
      listingId,
      createdBy: null,
      publishMode: 'NOW',
      scheduledAt: null,
      contentSnapshot: { title: 'fixture' },
      assetSnapshot: [],
      platforms: ['FACEBOOK_PAGE'],
    });
    const targetId = publication.targets[0].id as string;

    await query(
      `UPDATE social_publications
          SET status = 'PROCESSING'
        WHERE id = $1`,
      [publication.id],
    );
    await query(
      `UPDATE social_publication_targets
          SET status = 'AMBIGUOUS', last_error_code = 'PROVIDER_TIMEOUT'
        WHERE id = $1`,
      [targetId],
    );

    return { publicationId: publication.id as string, targetId, listingId };
  }

  function operatorInput(
    fixture: { publicationId: string; targetId: string },
    overrides: Partial<Parameters<typeof applySocialTargetOperatorAction>[1]> = {},
  ) {
    return {
      tenantId: tenantA,
      publicationId: fixture.publicationId,
      targetId: fixture.targetId,
      actorId: actorA,
      action: 'MARK_FAILED' as const,
      reason: 'Xác nhận thủ công sau khi provider timeout.',
      ...overrides,
    };
  }

  async function postReconcile(
    fixture: { publicationId: string; targetId: string },
    body: Record<string, unknown>,
    headers: Record<string, string> = {},
  ) {
    const response = await fetch(
      `${httpBaseUrl}/api/social-publications/${fixture.publicationId}/targets/${fixture.targetId}/reconcile`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(body),
      },
    );
    return {
      response,
      body: await response.json() as Record<string, unknown>,
    };
  }

  beforeAll(async () => {
    schema = `social_publication_reconcile_${process.pid}_${Date.now()}`;
    const adminPool = new Pool({
      connectionString: baseConnectionString,
      max: 1,
      connectionTimeoutMillis: 10_000,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
    try {
      await adminPool.query(`CREATE SCHEMA "${schema}"`);
    } finally {
      await adminPool.end();
    }

    setupPool = new Pool({
      connectionString: connectionWithSchema(),
      max: 1,
      connectionTimeoutMillis: 10_000,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
    setupClient = await setupPool.connect();
    await setupClient.query(`SET search_path TO "${schema}", public`);
    await setupClient.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await setupClient.query(`
      CREATE TABLE projects (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        is_featured BOOLEAN NOT NULL DEFAULT FALSE,
        priority INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await setupClient.query(`
      CREATE TABLE listings (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        status VARCHAR(50) NOT NULL,
        code TEXT,
        title TEXT NOT NULL
      )
    `);
    await migration186.up(setupClient);
    await migration187.up(setupClient);
    await migration190.up(setupClient);
    setupClient.release();
    setupClient = undefined;

    workerA = new Pool({
      connectionString: connectionWithSchema(),
      max: 1,
      connectionTimeoutMillis: 10_000,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
    workerB = new Pool({
      connectionString: connectionWithSchema(),
      max: 1,
      connectionTimeoutMillis: 10_000,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });

    httpPool = new Pool({
      connectionString: connectionWithSchema(),
      max: 4,
      connectionTimeoutMillis: 10_000,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
    const app = express();
    app.use(express.json());
    app.use(createSocialPublicationRouter(httpPool, (req, _res, next) => {
      (req as any).user = {
        tenantId: req.header('x-test-tenant') || tenantA,
        id: req.header('x-test-actor') || actorA,
        role: 'ADMIN',
      };
      next();
    }));
    httpServer = app.listen(0);
    await new Promise<void>((resolve) => httpServer.once('listening', () => resolve()));
    const address = httpServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('HTTP test server did not expose a TCP address');
    }
    httpBaseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer.close(error => error ? reject(error) : resolve());
      });
    }
    await httpPool?.end();
    await workerA?.end();
    await workerB?.end();
    setupClient?.release();
    setupClient = undefined;
    if (setupPool) {
      await setupPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await setupPool.end();
    }
  });

  it('lets only one concurrent operator reconcile the same target', async () => {
    const fixture = await createFixture();

    const results = await Promise.all([
      applySocialTargetOperatorAction(workerA, operatorInput(fixture)),
      applySocialTargetOperatorAction(workerB, operatorInput(fixture, {
        actorId: actorB,
      })),
    ]);

    expect(results.map(result => result.kind).sort()).toEqual(['INVALID_STATE', 'OK']);

    const state = await query(
      `SELECT p.status AS publication_status, t.status AS target_status
         FROM social_publications p
         JOIN social_publication_targets t ON t.publication_id = p.id
        WHERE p.id = $1 AND t.id = $2`,
      [fixture.publicationId, fixture.targetId],
    );
    expect(state.rows).toEqual([{
      publication_status: 'FAILED',
      target_status: 'FAILED_FINAL',
    }]);

    const audit = await query(
      `SELECT actor_id, event_type, from_status, to_status
         FROM social_publication_events
        WHERE publication_id = $1 AND target_id = $2
        ORDER BY created_at`,
      [fixture.publicationId, fixture.targetId],
    );
    expect(audit.rows).toHaveLength(1);
    expect([actorA, actorB]).toContain(audit.rows[0].actor_id);
    expect(audit.rows[0]).toMatchObject({
      event_type: 'OPERATOR_MARK_FAILED',
      from_status: 'AMBIGUOUS',
      to_status: 'FAILED_FINAL',
    });
  });

  it('returns one HTTP success and one state conflict for concurrent reconciliation', async () => {
    const fixture = await createFixture();
    const body = {
      action: 'MARK_FAILED',
      reason: 'Xác nhận thủ công sau khi provider timeout.',
    };

    const results = await Promise.all([
      postReconcile(fixture, body, { 'x-test-actor': actorA }),
      postReconcile(fixture, body, { 'x-test-actor': actorB }),
    ]);

    expect(results.map(({ response }) => response.status).sort()).toEqual([200, 409]);
    const conflict = results.find(({ response }) => response.status === 409);
    expect(conflict?.body).toMatchObject({ code: 'TARGET_STATE_CONFLICT' });
    const success = results.find(({ response }) => response.status === 200);
    expect(success?.body).toHaveProperty('id', fixture.publicationId);
  });

  it('returns HTTP 404 for another tenant without changing state or audit events', async () => {
    const fixture = await createFixture();

    const result = await postReconcile(
      fixture,
      {
        action: 'MARK_FAILED',
        reason: 'Tenant khác thử xử lý target.',
      },
      { 'x-test-tenant': tenantB, 'x-test-actor': actorB },
    );

    expect(result.response.status).toBe(404);
    expect(result.body).toEqual({
      error: 'Không tìm thấy publication target trong tenant hiện tại',
    });

    const state = await query(
      `SELECT p.status AS publication_status, t.status AS target_status,
              (SELECT count(*) FROM social_publication_events e
                WHERE e.publication_id = p.id AND e.target_id = t.id) AS event_count
         FROM social_publications p
         JOIN social_publication_targets t ON t.publication_id = p.id
        WHERE p.id = $1 AND t.id = $2`,
      [fixture.publicationId, fixture.targetId],
    );
    expect(state.rows[0]).toMatchObject({
      publication_status: 'PROCESSING',
      target_status: 'AMBIGUOUS',
      event_count: 0,
    });
  });

  it('returns HTTP conflicts for requeueing AMBIGUOUS and validates confirmation IDs', async () => {
    const fixture = await createFixture();

    const requeue = await postReconcile(fixture, {
      action: 'REQUEUE',
      reason: 'Chưa đủ bằng chứng để requeue.',
    });
    expect(requeue.response.status).toBe(409);
    expect(requeue.body).toMatchObject({ code: 'TARGET_STATE_CONFLICT' });

    const confirm = await postReconcile(fixture, {
      action: 'CONFIRM_PUBLISHED',
      reason: 'Provider xác nhận bài đã tồn tại.',
    });
    expect(confirm.response.status).toBe(400);
    expect(confirm.body).toEqual({
      error: 'Cần provider post ID để xác nhận đã đăng',
    });
  });

  it('does not expose or mutate a publication through another tenant', async () => {
    const fixture = await createFixture(tenantA);

    expect(await findSocialPublication(workerB, tenantB, fixture.publicationId)).toBeNull();
    expect(await listSocialPublications(workerB, tenantB)).toEqual([]);

    const result = await applySocialTargetOperatorAction(workerB, operatorInput(fixture, {
      tenantId: tenantB,
      actorId: actorB,
    }));
    expect(result).toEqual({ kind: 'NOT_FOUND' });

    const state = await query(
      `SELECT p.status AS publication_status, t.status AS target_status,
              (SELECT count(*) FROM social_publication_events e
                WHERE e.publication_id = p.id AND e.target_id = t.id) AS event_count
         FROM social_publications p
         JOIN social_publication_targets t ON t.publication_id = p.id
        WHERE p.id = $1 AND t.id = $2`,
      [fixture.publicationId, fixture.targetId],
    );
    expect(state.rows[0]).toMatchObject({
      publication_status: 'PROCESSING',
      target_status: 'AMBIGUOUS',
      event_count: 0,
    });
  });

  it('loads listing review across UUID and varchar tenant IDs without crossing tenants', async () => {
    const matchingFixture = await createFixture(tenantA);
    const foreignPublication = await createFixture(tenantB);
    const mismatchedListingFixture = await createFixture(tenantA, tenantB);

    const matchingPublication = await findSocialPublication(
      workerA,
      tenantA,
      matchingFixture.publicationId,
    );
    expect(matchingPublication).toMatchObject({
      id: matchingFixture.publicationId,
      tenantId: tenantA,
      listingId: matchingFixture.listingId,
      listingReview: {
        eligible: true,
        listingExists: true,
        listingStatus: 'AVAILABLE',
        listingCode: `fixture-${matchingFixture.listingId}`,
        listingTitle: `Listing ${matchingFixture.listingId}`,
      },
    });

    const mismatchedListingPublication = await findSocialPublication(
      workerA,
      tenantA,
      mismatchedListingFixture.publicationId,
    );
    expect(mismatchedListingPublication).toMatchObject({
      id: mismatchedListingFixture.publicationId,
      tenantId: tenantA,
      listingId: mismatchedListingFixture.listingId,
      listingReview: {
        eligible: false,
        listingExists: false,
        listingStatus: null,
        listingCode: null,
        listingTitle: null,
        reason: 'LISTING_NOT_FOUND',
      },
    });

    expect(await findSocialPublication(workerA, tenantA, foreignPublication.publicationId)).toBeNull();
  });

  it('requires confirmation or failure before requeueing an ambiguous target', async () => {
    const confirmationFixture = await createFixture();

    expect(await applySocialTargetOperatorAction(workerA, operatorInput(confirmationFixture, {
      action: 'REQUEUE',
      reason: 'Chưa đủ bằng chứng để requeue.',
    }))).toMatchObject({
      kind: 'INVALID_STATE',
      status: 'AMBIGUOUS',
    });
    expect(await applySocialTargetOperatorAction(workerA, operatorInput(confirmationFixture, {
      action: 'CONFIRM_PUBLISHED',
      reason: 'Provider xác nhận bài đã tồn tại.',
    })).then(result => result.kind)).toBe('INVALID_INPUT');

    const confirmed = await applySocialTargetOperatorAction(workerA, operatorInput(confirmationFixture, {
      action: 'CONFIRM_PUBLISHED',
      reason: 'Provider xác nhận bài đã tồn tại.',
      providerPostId: 'provider-post-123',
      providerPostUrl: 'https://provider.test/posts/123',
    }));
    expect(confirmed.kind).toBe('OK');

    const confirmedState = await query(
      `SELECT p.status AS publication_status, t.status AS target_status,
              t.provider_post_id, count(e.id)::text AS event_count
         FROM social_publications p
         JOIN social_publication_targets t ON t.publication_id = p.id
         LEFT JOIN social_publication_events e ON e.target_id = t.id
        WHERE p.id = $1 AND t.id = $2
        GROUP BY p.status, t.status, t.provider_post_id`,
      [confirmationFixture.publicationId, confirmationFixture.targetId],
    );
    expect(confirmedState.rows[0]).toMatchObject({
      publication_status: 'PUBLISHED',
      target_status: 'PUBLISHED',
      provider_post_id: 'provider-post-123',
      event_count: '1',
    });

    const failureFixture = await createFixture();
    const markedFailed = await applySocialTargetOperatorAction(workerA, operatorInput(failureFixture, {
      action: 'MARK_FAILED',
      reason: 'Đánh dấu thất bại để retry có kiểm soát.',
    }));
    expect(markedFailed.kind).toBe('OK');

    const requeued = await applySocialTargetOperatorAction(workerA, operatorInput(failureFixture, {
      action: 'REQUEUE',
      reason: 'Đã đánh dấu thất bại trước khi đưa lại vào hàng đợi.',
    }));
    expect(requeued.kind).toBe('OK');

    const requeuedState = await query(
      `SELECT p.status AS publication_status, t.status AS target_status,
              count(e.id)::text AS event_count
         FROM social_publications p
         JOIN social_publication_targets t ON t.publication_id = p.id
         LEFT JOIN social_publication_events e ON e.target_id = t.id
        WHERE p.id = $1 AND t.id = $2
        GROUP BY p.status, t.status`,
      [failureFixture.publicationId, failureFixture.targetId],
    );
    expect(requeuedState.rows[0]).toMatchObject({
      publication_status: 'PARTIALLY_PUBLISHED',
      target_status: 'PENDING',
      event_count: '2',
    });
  });
});
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import migration186 from '../migrations/186_social_publications';
import migration187 from '../migrations/187_social_publication_audit';
import migration190 from '../migrations/190_auto_posting_phase3';
import migration192 from '../migrations/192_social_publication_project_source';
import migration193 from '../migrations/193_marketing_facebook_daily_runs';
import migration194 from '../migrations/194_marketing_facebook_backfills';
import migration197 from '../migrations/197_auto_posting_multi_slot';
import migration199 from '../migrations/199_normalize_project_social_images';
import migration201 from '../migrations/201_repair_auto_posting_conflict_targets';
import migration211 from '../migrations/211_repair_marketing_daily_run_ledger';
import {
  createSocialPublication,
  findSocialPublication,
  listSocialPublications,
} from '../repositories/socialPublicationRepository';
import {
  claimMarketingFacebookDailyRun,
  createMarketingFacebookBackfillRequest,
  finishMarketingFacebookBackfillRequest,
  finishMarketingFacebookDailyRun,
  getMarketingFacebookDailyStatus,
  upsertAutoPostingSettings,
} from '../repositories/autoPostingRepository';
import {
  runAutoPostingCatchUp,
  runAutoPostingBackfill,
  runAutoPostingForTenant,
  runAutoPostingTick,
} from '../services/autoPostingSelector';
import { getTenantSocialPlatformCapability } from '../social-publishing/registry';
import { processSocialPublicationTick } from '../services/socialPublishingWorker';
import type { SocialPlatform } from '../social-publishing/types';
import { emailService } from '../services/emailService';

vi.mock('../social-publishing/registry', () => ({
  getTenantSocialPlatformCapability: vi.fn(),
}));

vi.mock('../services/socialPublishingWorker', () => ({
  processSocialPublicationTick: vi.fn(async () => ({
    picked: 1,
    published: 1,
    failed: 0,
    skipped: false,
  })),
}));

vi.mock('../services/emailService', () => ({
  emailService: {
    sendMarketingPublicationFailureEmail: vi.fn(async () => ({ success: true, status: 'sent' })),
  },
}));

vi.mock('../services/socialPublicationService', async () => {
  const actual = await vi.importActual<typeof import('../services/socialPublicationService')>(
    '../services/socialPublicationService',
  );
  return {
    ...actual,
    buildSocialProductSnapshot: vi.fn(async (_tenantId: string, listingId: string) => ({
      version: 1,
      listingId,
      code: `AUTO-${listingId.slice(0, 8)}`,
      title: `Listing ${listingId}`,
      description: null,
      price: null,
      currency: 'VND',
      area: null,
      builtArea: null,
      bedrooms: null,
      bathrooms: null,
      location: null,
      type: 'Nhà phố',
      transaction: 'Bán',
      status: 'AVAILABLE',
      attributes: {},
      contactPhone: null,
      publicUrl: null,
      capturedAt: new Date().toISOString(),
    })),
    buildSocialProjectSnapshot: vi.fn(async (_tenantId: string, projectId: string) => ({
      version: 1,
      projectId,
      code: `PROJECT-${projectId.slice(0, 8)}`,
      title: `Project ${projectId}`,
      description: null,
      location: null,
      totalUnits: null,
      status: 'ACTIVE',
      priceLabel: 'Liên hệ',
      images: ['https://cdn.example.test/project.jpg'],
      publicUrl: `https://sgsland.example/p/PROJECT-${projectId.slice(0, 8)}`,
      capturedAt: new Date().toISOString(),
    })),
    buildPlatformContent: vi.fn((_snapshot: unknown, platform: string, images: string[]) => ({
      text: `${platform} auto`,
      imageUrls: images,
    })),
  };
});

const integrationUrl = process.env.INTEGRITY_PG_URL || process.env.AIVEN_DATABASE_URL;
const describePostgres = integrationUrl ? describe : describe.skip;
const baseConnectionString = integrationUrl?.replace(
  /([?&])(?:sslmode|channel_binding)=[^&]*/g,
  '$1',
).replace(/[?&]$/, '');
const useSsl = process.env.INTEGRITY_PG_SSL !== 'false';
const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const runAtSevenPmVietnam = new Date('2026-01-02T12:00:00.000Z');

type CapabilityConfig = Partial<Record<SocialPlatform, {
  status: 'READY' | 'NOT_READY';
  reason: string;
  retryable: boolean;
}>>;

describePostgres('Marketing Facebook daily selector against PostgreSQL', () => {
  let setupPool: Pool;
  let setupClient: PoolClient | undefined;
  let schema: string;

  function connectionWithSchema(): string {
    const separator = baseConnectionString!.includes('?') ? '&' : '?';
    const options = encodeURIComponent(`-c search_path="${schema}",public`);
    return `${baseConnectionString}${separator}options=${options}`;
  }

  async function query(text: string, values?: unknown[]) {
    return setupPool.query(text, values);
  }

  async function insertProject(input: {
    tenantId: string;
    name?: string;
    status?: string;
    images?: string[];
    metadata?: Record<string, unknown>;
    createdAt?: string;
  }) {
    const id = randomUUID();
    await query(
      `INSERT INTO projects
         (id, tenant_id, name, code, status, metadata, is_featured, priority, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, FALSE, 0,
               COALESCE($7::timestamptz, NOW()), COALESCE($7::timestamptz, NOW()))`,
      [
        id,
         input.tenantId,
         input.name || `Project ${id}`,
         `PROJECT-${id.slice(0, 8)}`,
         input.status || 'ACTIVE',
         JSON.stringify(input.metadata ?? (input.images === undefined ? {
           coverImage: 'https://cdn.example.test/project.jpg',
           gallery: [],
         } : {
           coverImage: input.images[0] || null,
           gallery: input.images.slice(1),
         })),
         input.createdAt || null,
      ],
    );
    return id;
  }

  async function insertListing(input: {
    tenantId: string;
    projectId?: string | null;
    title?: string;
    images?: string[];
    createdAt?: string;
  }) {
    const id = randomUUID();
    await query(
      `INSERT INTO listings
         (id, tenant_id, project_id, project_code, title, code, description, status,
          price, currency, area, built_area, bedrooms, bathrooms, location, type,
          transaction, attributes, images, created_at, updated_at)
       VALUES ($1, $2, $3, NULL, $4, $5, NULL, 'AVAILABLE',
               NULL, 'VND', NULL, NULL, NULL, NULL, NULL, 'Nhà phố',
               'Bán', '{}'::jsonb, $6::jsonb,
               COALESCE($7::timestamptz, NOW()), COALESCE($7::timestamptz, NOW()))`,
      [
        id,
        input.tenantId,
        input.projectId || null,
        input.title || `Listing ${id}`,
        `LISTING-${id.slice(0, 8)}`,
        JSON.stringify(input.images === undefined ? ['https://cdn.example.test/listing.jpg'] : input.images),
        input.createdAt || null,
      ],
    );
    return id;
  }

  async function configureSelector(tenantId: string, enabled = true) {
    await upsertAutoPostingSettings(setupPool, tenantId, {
      enabled,
      postsPerDay: 1,
      recycleAfterDays: 0,
      platforms: ['FACEBOOK_PAGE'],
      timeWindows: [{ start: '18:30', end: '23:59' }],
    });
  }

  function configureCapabilities(config: CapabilityConfig) {
    vi.mocked(getTenantSocialPlatformCapability).mockImplementation(
      async (platform: SocialPlatform) => {
        const configured = config[platform] || {
          status: 'NOT_READY' as const,
          reason: `${platform} chưa sẵn sàng trong fixture`,
          retryable: false,
        };
        return {
          platform,
          label: platform,
          kind: 'PUBLIC_POST' as const,
          status: configured.status,
          canPublish: configured.status === 'READY',
          messagingSupported: false,
          reason: configured.reason,
          retryable: configured.retryable,
          requiresConnection: true,
        };
      },
    );
  }

  beforeAll(async () => {
    schema = `marketing_facebook_${process.pid}_${Date.now()}`;
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
      max: 2,
      connectionTimeoutMillis: 10_000,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
    setupClient = await setupPool.connect();
    await setupClient.query(`SET search_path TO "${schema}", public`);
    await setupClient.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await setupClient.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY,
        tenant_id UUID,
        name TEXT,
        email TEXT,
        avatar TEXT,
        role TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE'
      );
      CREATE TABLE agent_signals (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        signal_type TEXT NOT NULL,
        actor_id TEXT,
        subject_type TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        dedupe_key TEXT,
        provenance TEXT NOT NULL DEFAULT 'system',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX agent_signals_tenant_dedupe
        ON agent_signals(tenant_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
      CREATE TABLE ai_learning_audit_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        event_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id UUID NOT NULL,
        reason TEXT NOT NULL,
        metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        user_id UUID NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        read_at TIMESTAMPTZ
      );
      CREATE TABLE projects (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(100),
        status VARCHAR(50) DEFAULT 'ACTIVE',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        is_featured BOOLEAN NOT NULL DEFAULT FALSE,
        priority INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE listings (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        project_id UUID,
        project_code VARCHAR(100),
        title TEXT NOT NULL,
        code TEXT,
        description TEXT,
        status VARCHAR(50) NOT NULL,
        price NUMERIC,
        currency VARCHAR(20),
        area NUMERIC,
        built_area NUMERIC,
        bedrooms NUMERIC,
        bathrooms NUMERIC,
        location TEXT,
        type TEXT,
        transaction TEXT,
        attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
        images JSONB NOT NULL DEFAULT '[]'::jsonb,
        assigned_to UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await migration186.up(setupClient);
    await migration187.up(setupClient);
    await migration190.up(setupClient);
    await migration192.up(setupClient);
    await migration193.up(setupClient);
    await migration194.up(setupClient);
    await migration197.up(setupClient);
    await migration199.up(setupClient);
    await setupClient.query(`SET search_path TO "${schema}"`);
    await setupClient.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_facebook_daily_runs_day_slot
        ON marketing_facebook_daily_runs(tenant_id, logical_day, slot_index);
    `);
    await setupClient.query(`
      ALTER TABLE social_publication_targets
        DROP CONSTRAINT IF EXISTS social_publication_targets_unique_target;
    `);
    await migration201.up(setupClient);
    await setupClient.query(`SET search_path TO "${schema}", public`);
    setupClient.release();
    setupClient = undefined;
  });

  beforeEach(async () => {
    await query(`
      TRUNCATE marketing_facebook_backfill_requests, marketing_facebook_daily_runs, social_publication_events,
        social_publications, auto_posting_settings, listings, projects,
        agent_signals, ai_learning_audit_events, notifications, users CASCADE
    `);
    vi.clearAllMocks();
  });

  it('repairs the daily-run conflict key after migration history drift', async () => {
    await query(`DROP INDEX IF EXISTS "${schema}".idx_marketing_facebook_daily_runs_day_slot`);

    await query(
      `INSERT INTO marketing_facebook_daily_runs
         (tenant_id, logical_day, slot_index, status)
       VALUES
         ($1, $2::date, 0, 'RUNNING'),
         ($1, $2::date, 1, 'SKIPPED')`,
      [tenantA, '2026-01-04'],
    );

    const client = await setupPool.connect();
    try {
      await migration211.up(client);
    } finally {
      client.release();
    }

    const duplicate = await claimMarketingFacebookDailyRun(setupPool, tenantA, '2026-01-04', 0);
    expect(duplicate).toBeNull();
    const index = await query(
      `SELECT 1
         FROM pg_indexes
        WHERE schemaname = current_schema()
          AND indexname = 'idx_marketing_facebook_daily_runs_day_slot'`,
    );
    expect(index.rowCount).toBe(1);
  });

  afterAll(async () => {
    setupClient?.release();
    setupClient = undefined;
    if (setupPool) {
      const repairClient = await setupPool.connect();
      try {
        await repairClient.query('SET search_path TO public');
        await migration211.up(repairClient);
      } finally {
        repairClient.release();
      }
      await setupPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await setupPool.end();
    }
  });

  it('selects only the current tenant and can choose a project as an independent source', async () => {
    const oldProject = await insertProject({
      tenantId: tenantA,
      name: 'Tenant A project',
      createdAt: '2025-12-01T00:00:00.000Z',
    });
    await insertListing({ tenantId: tenantA, createdAt: '2025-12-02T00:00:00.000Z' });
    await insertListing({ tenantId: tenantB, createdAt: '2025-11-01T00:00:00.000Z' });
    await configureSelector(tenantA);
    configureCapabilities({
      FACEBOOK_PAGE: { status: 'READY', reason: 'Facebook đã xác minh', retryable: false },
    });

    const result = await runAutoPostingForTenant(setupPool, tenantA, runAtSevenPmVietnam);
    expect(result).toMatchObject({
      created: 1,
      reason: 'OK',
      sourceType: 'PROJECT',
      sourceId: oldProject,
    });
    const publications = await query(
      `SELECT tenant_id, listing_id, project_id, status, source
         FROM social_publications`,
    );
    expect(publications.rows).toEqual([{
      tenant_id: tenantA,
      listing_id: null,
      project_id: oldProject,
      status: 'PROCESSING',
      source: 'AUTO',
    }]);
  });

  it('selects a project whose only image is stored in metadata.image', async () => {
    const projectId = await insertProject({
      tenantId: tenantA,
      metadata: { image: 'https://cdn.example.test/metadata-image.jpg' },
    });
    await configureSelector(tenantA);
    configureCapabilities({
      FACEBOOK_PAGE: { status: 'READY', reason: 'Facebook đã xác minh', retryable: false },
    });

    const result = await runAutoPostingForTenant(setupPool, tenantA, runAtSevenPmVietnam);

    expect(result).toMatchObject({
      created: 1,
      reason: 'OK',
      sourceType: 'PROJECT',
      sourceId: projectId,
    });
  });

  it('prioritizes a source that has never had a successful Facebook publication', async () => {
    const alreadyPublishedListingId = await insertListing({ tenantId: tenantA, createdAt: '2025-01-01T00:00:00.000Z' });
    const neverPublishedListingId = await insertListing({ tenantId: tenantA, createdAt: '2025-12-01T00:00:00.000Z' });
    const previous = await createSocialPublication(setupPool, {
      tenantId: tenantA,
      listingId: alreadyPublishedListingId,
      createdBy: null,
      publishMode: 'NOW',
      scheduledAt: null,
      contentSnapshot: { title: 'previous' },
      assetSnapshot: ['https://cdn.example.test/old.jpg'],
      platforms: ['FACEBOOK_PAGE'],
    });
    await query(
      `UPDATE social_publication_targets
          SET status = 'PUBLISHED', published_at = '2025-12-15T00:00:00.000Z'
        WHERE publication_id = $1`,
      [previous.id],
    );
    await configureSelector(tenantA);
    configureCapabilities({
      FACEBOOK_PAGE: { status: 'READY', reason: 'Facebook đã xác minh', retryable: false },
    });

    const result = await runAutoPostingForTenant(setupPool, tenantA, runAtSevenPmVietnam);
    expect(result).toMatchObject({
      created: 1,
      sourceType: 'LISTING',
      sourceId: neverPublishedListingId,
    });
    expect(result.sourceId).not.toBe(alreadyPublishedListingId);
  });

  it('does not post without an eligible image and records a visible skip audit', async () => {
    await insertListing({ tenantId: tenantA, images: [] });
    await insertProject({ tenantId: tenantA, images: [] });
    await configureSelector(tenantA);
    configureCapabilities({
      FACEBOOK_PAGE: { status: 'READY', reason: 'Facebook đã xác minh', retryable: false },
    });

    const result = await runAutoPostingForTenant(setupPool, tenantA, runAtSevenPmVietnam);
    expect(result).toMatchObject({ created: 0, skipped: 1, reason: 'NO_ELIGIBLE_SOURCE' });
    const audit = await query(
      `SELECT status, error_code, error_message, result
         FROM marketing_facebook_daily_runs
        WHERE tenant_id = $1`,
      [tenantA],
    );
    expect(audit.rows[0]).toMatchObject({
      status: 'SKIPPED',
      error_code: 'NO_ELIGIBLE_SOURCE',
      result: expect.objectContaining({ reason: 'NO_ELIGIBLE_SOURCE' }),
    });
    expect(audit.rows[0].error_message).toContain('không có listing hoặc dự án');
  });

  it('does not create repeated skipped slots when the daily scheduler has no eligible source', async () => {
    await insertListing({ tenantId: tenantA, images: [] });
    await configureSelector(tenantA);
    configureCapabilities({
      FACEBOOK_PAGE: { status: 'READY', reason: 'Facebook đã xác minh', retryable: false },
    });

    const firstTick = await runAutoPostingTick(setupPool, runAtSevenPmVietnam);
    const secondTick = await runAutoPostingTick(setupPool, runAtSevenPmVietnam);

    expect(firstTick.find(result => result.tenantId === tenantA)).toMatchObject({
      reason: 'NO_ELIGIBLE_SOURCE',
      skipped: 1,
    });
    expect(secondTick.find(result => result.tenantId === tenantA)).toBeUndefined();
    const audit = await query(
      `SELECT COUNT(*)::int AS count
         FROM marketing_facebook_daily_runs
        WHERE tenant_id = $1`,
      [tenantA],
    );
    expect(audit.rows[0].count).toBe(1);
  });

  it('publishes directly through the worker pipeline and refuses a second run for the same Vietnam day', async () => {
    const listingId = await insertListing({ tenantId: tenantA });
    await configureSelector(tenantA);
    configureCapabilities({
      FACEBOOK_PAGE: { status: 'READY', reason: 'Facebook đã xác minh', retryable: false },
    });

    const firstTrigger = await runAutoPostingTick(setupPool, runAtSevenPmVietnam);
    const secondTrigger = await runAutoPostingTick(setupPool, runAtSevenPmVietnam);
    const firstRun = firstTrigger.find(result => result.tenantId === tenantA);
    const secondRun = secondTrigger.find(result => result.tenantId === tenantA);

    expect(firstRun).toMatchObject({ created: 1, reason: 'OK', sourceId: listingId });
    expect(secondRun).toBeUndefined();
    const audit = await query(
      `SELECT status, to_char(logical_day, 'YYYY-MM-DD') AS logical_day, source_id
         FROM marketing_facebook_daily_runs WHERE tenant_id = $1`,
      [tenantA],
    );
    expect(audit.rows).toEqual([{
      status: 'SUCCESS',
      logical_day: '2026-01-02',
      source_id: listingId,
    }]);
  });

  it('records a failed daily run when the Facebook worker reports delivery failure', async () => {
    await insertListing({ tenantId: tenantA });
    await query(
      `INSERT INTO users (id, tenant_id, name, email, role)
       VALUES ($1, $2, 'Marketing Admin', 'admin@example.test', 'ADMIN')`,
      [randomUUID(), tenantA],
    );
    await configureSelector(tenantA);
    configureCapabilities({
      FACEBOOK_PAGE: { status: 'READY', reason: 'Facebook đã xác minh', retryable: false },
    });
    vi.mocked(processSocialPublicationTick).mockResolvedValueOnce({
      picked: 1,
      published: 0,
      failed: 1,
      skipped: false,
    });

    const result = await runAutoPostingForTenant(setupPool, tenantA, runAtSevenPmVietnam);
    expect(result).toMatchObject({ created: 1, reason: 'PUBLISH_FAILED' });
    const audit = await query(
      `SELECT status, error_code, result
         FROM marketing_facebook_daily_runs WHERE tenant_id = $1`,
      [tenantA],
    );
    expect(audit.rows[0]).toMatchObject({
      status: 'FAILED',
      error_code: 'FACEBOOK_DELIVERY_FAILED',
      result: expect.objectContaining({ reason: 'FACEBOOK_DELIVERY_FAILED' }),
    });
    const signal = await query(
      `SELECT signal_type, subject_type, payload
         FROM agent_signals
        WHERE tenant_id = $1`,
      [tenantA],
    );
    expect(signal.rows).toHaveLength(1);
    expect(signal.rows[0]).toMatchObject({
      signal_type: 'marketing_publication_failed',
      subject_type: 'marketing_facebook_daily_run',
      payload: expect.objectContaining({
        errorCode: 'FACEBOOK_DELIVERY_FAILED',
      }),
    });
    const notification = await query(
      `SELECT type, title, metadata
         FROM notifications
        WHERE tenant_id = $1`,
      [tenantA],
    );
    expect(notification.rows).toHaveLength(1);
    expect(notification.rows[0]).toMatchObject({
      type: 'MARKETING_PUBLICATION_FAILED',
      title: 'Agent Marketing không đăng được Facebook',
      metadata: expect.objectContaining({ errorCode: 'FACEBOOK_DELIVERY_FAILED' }),
    });
    expect(emailService.sendMarketingPublicationFailureEmail).toHaveBeenCalledTimes(1);
  });

  it('runs a requested missed day outside the normal window and audits the requester, reason, and result', async () => {
    const listingId = await insertListing({ tenantId: tenantA });
    await configureSelector(tenantA);
    configureCapabilities({
      FACEBOOK_PAGE: { status: 'READY', reason: 'Facebook đã xác minh', retryable: false },
    });

    const result = await runAutoPostingBackfill(
      setupPool,
      tenantA,
      '2025-12-31',
      'QStash bị gián đoạn trong lúc triển khai',
      'manager-1',
      new Date('2026-01-03T03:00:00.000Z'),
    );

    expect(result).toMatchObject({
      created: 1,
      reason: 'OK',
      sourceId: listingId,
      backfillRequestId: expect.any(String),
    });
    const audit = await query(
      `SELECT logical_day, status, reason, requested_by, result
         FROM marketing_facebook_backfill_requests
        WHERE tenant_id = $1`,
      [tenantA],
    );
    expect(audit.rows[0]).toMatchObject({
      logical_day: new Date('2025-12-31T00:00:00.000Z'),
      status: 'SUCCESS',
      reason: 'QStash bị gián đoạn trong lúc triển khai',
      requested_by: 'manager-1',
      result: expect.objectContaining({
        mode: 'BACKFILL',
        logicalDay: '2025-12-31',
        backfillReason: 'QStash bị gián đoạn trong lúc triển khai',
        requestedBy: 'manager-1',
      }),
    });
    const publication = await query(
      `SELECT auto_posting_key
         FROM social_publications
        WHERE tenant_id = $1`,
      [tenantA],
    );
    expect(publication.rows[0].auto_posting_key).toBe(`2025-12-31:0:LISTING:${listingId}`);
  });

  it('requeues a failed or skipped backfill without bypassing provider outcome guards', async () => {
    await configureSelector(tenantA);
    configureCapabilities({
      FACEBOOK_PAGE: { status: 'READY', reason: 'Facebook đã xác minh', retryable: false },
    });

    const first = await runAutoPostingBackfill(
      setupPool,
      tenantA,
      '2025-12-30',
      'Lần đầu chưa có ảnh hợp lệ',
      'manager-1',
      new Date('2026-01-03T03:00:00.000Z'),
    );
    expect(first).toMatchObject({ reason: 'NO_ELIGIBLE_SOURCE', backfillRequestId: expect.any(String) });

    const listingId = await insertListing({ tenantId: tenantA });
    const retry = await runAutoPostingBackfill(
      setupPool,
      tenantA,
      '2025-12-30',
      'Đã bổ sung ảnh HTTPS, chạy lại',
      'manager-2',
      new Date('2026-01-03T03:00:00.000Z'),
    );
    expect(retry).toMatchObject({
      created: 1,
      reason: 'OK',
      sourceId: listingId,
      backfillRequestId: first.backfillRequestId,
    });

    const request = await query(
      `SELECT status, reason, requested_by
         FROM marketing_facebook_backfill_requests
        WHERE tenant_id = $1 AND logical_day = $2::date`,
      [tenantA, '2025-12-30'],
    );
    expect(request.rows[0]).toMatchObject({
      status: 'SUCCESS',
      reason: 'Đã bổ sung ảnh HTTPS, chạy lại',
      requested_by: 'manager-2',
    });
  });

  it('automatically retries a failed backfill after the scheduled window', async () => {
    await configureSelector(tenantA);
    configureCapabilities({
      FACEBOOK_PAGE: { status: 'READY', reason: 'Facebook đã xác minh', retryable: false },
    });
    const request = await createMarketingFacebookBackfillRequest(setupPool, {
      tenantId: tenantA,
      logicalDay: '2026-01-03',
      reason: 'QStash bị gián đoạn',
      requestedBy: 'system:auto-scheduler',
    });
    await finishMarketingFacebookBackfillRequest(setupPool, request.request.id, {
      status: 'FAILED',
      errorCode: '42P10',
      errorMessage: 'missing conflict index',
      result: { reason: 'ERROR', logicalDay: '2026-01-02' },
    });

    await runAutoPostingCatchUp(setupPool, new Date('2026-01-03T17:30:00.000Z'));

    const retried = await query(
      `SELECT status, error_code, error_message
         FROM marketing_facebook_backfill_requests
        WHERE id = $1`,
      [request.request.id],
    );
    expect(retried.rows[0]).toMatchObject({
      status: 'SKIPPED',
      error_code: 'NO_ELIGIBLE_SOURCE',
    });
  });

  it('blocks backfill after an ambiguous Facebook result and never creates another publication', async () => {
    const listingId = await insertListing({ tenantId: tenantA });
    await configureSelector(tenantA);
    configureCapabilities({
      FACEBOOK_PAGE: { status: 'READY', reason: 'Facebook đã xác minh', retryable: false },
    });

    const first = await runAutoPostingForTenant(setupPool, tenantA, runAtSevenPmVietnam);
    expect(first).toMatchObject({ created: 1, sourceId: listingId });
    await query(
      `UPDATE social_publication_targets
          SET status = 'AMBIGUOUS',
              last_error_code = 'FACEBOOK_ALBUM_UPLOAD_OUTCOME_UNKNOWN'
        WHERE publication_id = $1`,
      [first.publicationId],
    );
    await query(
      `UPDATE marketing_facebook_daily_runs
          SET status = 'FAILED', publication_id = NULL
        WHERE tenant_id = $1 AND logical_day = $2::date`,
      [tenantA, '2026-01-02'],
    );

    const backfill = await runAutoPostingBackfill(
      setupPool,
      tenantA,
      '2026-01-02',
      'Deployment outage, cần kiểm tra lại kết quả',
      'manager-2',
      new Date('2026-01-03T03:00:00.000Z'),
    );

    expect(backfill).toMatchObject({
      created: 0,
      reason: 'PROVIDER_OUTCOME_UNKNOWN',
    });
    const publications = await query(
      `SELECT COUNT(*)::int AS count FROM social_publications WHERE tenant_id = $1`,
      [tenantA],
    );
    expect(publications.rows[0].count).toBe(1);
    const audit = await query(
      `SELECT status, error_code, reason, requested_by
         FROM marketing_facebook_backfill_requests
        WHERE tenant_id = $1`,
      [tenantA],
    );
    expect(audit.rows[0]).toMatchObject({
      status: 'BLOCKED',
      error_code: 'PROVIDER_OUTCOME_UNKNOWN',
      reason: 'Deployment outage, cần kiểm tra lại kết quả',
      requested_by: 'manager-2',
    });
  });

  it('returns only the requested tenant daily run and backfill history', async () => {
    await configureSelector(tenantA);
    await configureSelector(tenantB);

    const tenantADailyRun = await claimMarketingFacebookDailyRun(setupPool, tenantA, '2026-01-01');
    const tenantBDailyRun = await claimMarketingFacebookDailyRun(setupPool, tenantB, '2026-01-02');
    expect(tenantADailyRun).not.toBeNull();
    expect(tenantBDailyRun).not.toBeNull();

    await query(
      `UPDATE marketing_facebook_daily_runs
          SET started_at = CASE tenant_id
            WHEN $1 THEN '2026-01-01T08:00:00.000Z'::timestamptz
            WHEN $2 THEN '2026-01-02T08:00:00.000Z'::timestamptz
          END
        WHERE tenant_id IN ($1, $2)`,
      [tenantA, tenantB],
    );
    const finishedTenantARun = await finishMarketingFacebookDailyRun(setupPool, tenantADailyRun!.id, {
      status: 'SUCCESS',
      result: { tenant: 'A' },
    });
    const finishedTenantBRun = await finishMarketingFacebookDailyRun(setupPool, tenantBDailyRun!.id, {
      status: 'FAILED',
      errorCode: 'TENANT_B_FAILURE',
      errorMessage: 'Tenant B failure',
      result: { tenant: 'B' },
    });
    expect(finishedTenantARun).toMatchObject({
      id: tenantADailyRun!.id,
      tenantId: tenantA,
      status: 'SUCCESS',
    });
    expect(finishedTenantBRun).toMatchObject({
      id: tenantBDailyRun!.id,
      tenantId: tenantB,
      status: 'FAILED',
    });

    const tenantABackfill = await createMarketingFacebookBackfillRequest(setupPool, {
      tenantId: tenantA,
      logicalDay: '2025-12-30',
      reason: 'Tenant A backfill',
      requestedBy: 'manager-a',
    });
    const tenantBBackfill = await createMarketingFacebookBackfillRequest(setupPool, {
      tenantId: tenantB,
      logicalDay: '2025-12-31',
      reason: 'Tenant B backfill',
      requestedBy: 'manager-b',
    });
    expect(tenantABackfill.created).toBe(true);
    expect(tenantBBackfill.created).toBe(true);
    await finishMarketingFacebookBackfillRequest(setupPool, tenantABackfill.request.id, {
      status: 'SUCCESS',
      result: { tenant: 'A' },
    });
    await finishMarketingFacebookBackfillRequest(setupPool, tenantBBackfill.request.id, {
      status: 'FAILED',
      errorCode: 'TENANT_B_BACKFILL_FAILURE',
      result: { tenant: 'B' },
    });

    const tenantAStatus = await getMarketingFacebookDailyStatus(setupPool, tenantA, '2026-01-01');
    const tenantBStatus = await getMarketingFacebookDailyStatus(setupPool, tenantB, '2026-01-02');

    expect(tenantAStatus.settings.tenantId).toBe(tenantA);
    expect(tenantAStatus.todayRun).toMatchObject({
      id: tenantADailyRun!.id,
      tenantId: tenantA,
      logicalDay: '2026-01-01',
      status: 'SUCCESS',
    });
    expect(tenantAStatus.lastRun).toMatchObject({
      id: tenantADailyRun!.id,
      tenantId: tenantA,
      status: 'SUCCESS',
    });
    expect(tenantAStatus.backfillRequests).toEqual([
      expect.objectContaining({
        id: tenantABackfill.request.id,
        tenantId: tenantA,
        logicalDay: '2025-12-30',
        status: 'SUCCESS',
        reason: 'Tenant A backfill',
      }),
    ]);

    expect(tenantBStatus.settings.tenantId).toBe(tenantB);
    expect(tenantBStatus.todayRun).toMatchObject({
      id: tenantBDailyRun!.id,
      tenantId: tenantB,
      logicalDay: '2026-01-02',
      status: 'FAILED',
    });
    expect(tenantBStatus.lastRun).toMatchObject({
      id: tenantBDailyRun!.id,
      tenantId: tenantB,
      status: 'FAILED',
    });
    expect(tenantBStatus.backfillRequests).toEqual([
      expect.objectContaining({
        id: tenantBBackfill.request.id,
        tenantId: tenantB,
        logicalDay: '2025-12-31',
        status: 'FAILED',
        reason: 'Tenant B backfill',
      }),
    ]);
  });

  it('keeps social publication history isolated by tenant', async () => {
    const listingA = await insertListing({ tenantId: tenantA, title: 'Tenant A listing' });
    const listingB = await insertListing({ tenantId: tenantB, title: 'Tenant B listing' });
    await createSocialPublication(setupPool, {
      tenantId: tenantA,
      listingId: listingA,
      createdBy: null,
      publishMode: 'NOW',
      scheduledAt: null,
      contentSnapshot: { title: 'Tenant A publication' },
      assetSnapshot: [],
      platforms: ['FACEBOOK_PAGE'],
    });
    await createSocialPublication(setupPool, {
      tenantId: tenantB,
      listingId: listingB,
      createdBy: null,
      publishMode: 'NOW',
      scheduledAt: null,
      contentSnapshot: { title: 'Tenant B publication' },
      assetSnapshot: [],
      platforms: ['FACEBOOK_PAGE'],
    });

    const tenantAPublications = await listSocialPublications(setupPool, tenantA);
    const tenantBPublications = await listSocialPublications(setupPool, tenantB);
    expect(tenantAPublications).toHaveLength(1);
    expect(tenantAPublications[0]).toMatchObject({ tenantId: tenantA, listingId: listingA });
    expect(tenantBPublications).toHaveLength(1);
    expect(tenantBPublications[0]).toMatchObject({ tenantId: tenantB, listingId: listingB });
  });
});

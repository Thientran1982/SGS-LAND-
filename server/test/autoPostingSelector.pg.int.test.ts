import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import migration186 from '../migrations/186_social_publications';
import migration187 from '../migrations/187_social_publication_audit';
import migration190 from '../migrations/190_auto_posting_phase3';
import migration192 from '../migrations/192_social_publication_project_source';
import migration193 from '../migrations/193_marketing_facebook_daily_runs';
import {
  createSocialPublication,
  findSocialPublication,
  listSocialPublications,
} from '../repositories/socialPublicationRepository';
import { upsertAutoPostingSettings } from '../repositories/autoPostingRepository';
import { runAutoPostingForTenant } from '../services/autoPostingSelector';
import { getTenantSocialPlatformCapability } from '../social-publishing/registry';
import { processSocialPublicationTick } from '../services/socialPublishingWorker';
import type { SocialPlatform } from '../social-publishing/types';

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
        JSON.stringify(input.images === undefined ? {
          coverImage: 'https://cdn.example.test/project.jpg',
          gallery: [],
        } : {
          coverImage: input.images[0] || null,
          gallery: input.images.slice(1),
        }),
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
        name TEXT,
        email TEXT,
        avatar TEXT,
        role TEXT
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
    setupClient.release();
    setupClient = undefined;
  });

  beforeEach(async () => {
    await query(`
      TRUNCATE marketing_facebook_daily_runs, social_publication_events,
        social_publications, auto_posting_settings, listings, projects CASCADE
    `);
    vi.clearAllMocks();
  });

  afterAll(async () => {
    setupClient?.release();
    setupClient = undefined;
    if (setupPool) {
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

  it('publishes directly through the worker pipeline and refuses a second run for the same Vietnam day', async () => {
    const listingId = await insertListing({ tenantId: tenantA });
    await configureSelector(tenantA);
    configureCapabilities({
      FACEBOOK_PAGE: { status: 'READY', reason: 'Facebook đã xác minh', retryable: false },
    });

    const firstRun = await runAutoPostingForTenant(setupPool, tenantA, runAtSevenPmVietnam);
    const secondRun = await runAutoPostingForTenant(setupPool, tenantA, new Date('2026-01-02T16:00:00.000Z'));

    expect(firstRun).toMatchObject({ created: 1, reason: 'OK', sourceId: listingId });
    expect(secondRun).toEqual({
      created: 0,
      published: 0,
      skipped: 0,
      reason: 'DAILY_RUN_ALREADY_CLAIMED',
    });
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
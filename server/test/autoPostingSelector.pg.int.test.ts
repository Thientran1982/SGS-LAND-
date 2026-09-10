import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import migration186 from '../migrations/186_social_publications';
import migration187 from '../migrations/187_social_publication_audit';
import migration190 from '../migrations/190_auto_posting_phase3';
import {
  createSocialPublication,
  countSocialPublications,
  findSocialPublication,
  listSocialPublications,
} from '../repositories/socialPublicationRepository';
import { upsertAutoPostingSettings } from '../repositories/autoPostingRepository';
import { runAutoPostingForTenant } from '../services/autoPostingSelector';
import { getTenantSocialPlatformCapability } from '../social-publishing/registry';
import type { SocialPlatform } from '../social-publishing/types';

vi.mock('../social-publishing/registry', () => ({
  getTenantSocialPlatformCapability: vi.fn(),
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
    buildPlatformContent: vi.fn((_snapshot: unknown, platform: string, images: string[]) => ({
      text: `${platform} draft`,
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
const allPlatforms: SocialPlatform[] = ['FACEBOOK_PAGE', 'ZALO_BROADCAST'];

type CapabilityConfig = Partial<Record<SocialPlatform, {
  status: 'READY' | 'NOT_READY';
  reason: string;
  retryable: boolean;
}>>;

describePostgres('automatic posting selector against PostgreSQL', () => {
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
    name: string;
    featured?: boolean;
    priority?: number;
    status?: string;
  }) {
    const id = randomUUID();
    await query(
      `INSERT INTO projects
         (id, tenant_id, name, code, status, is_featured, priority, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [
        id,
        input.tenantId,
        input.name,
        `PROJECT-${id.slice(0, 8)}`,
        input.status || 'ACTIVE',
        input.featured ?? false,
        input.priority ?? 0,
      ],
    );
    return id;
  }

  async function insertListing(input: {
    tenantId: string;
    projectId?: string | null;
    title?: string;
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
               'Bán', '{}'::jsonb, '[]'::jsonb, COALESCE($6::timestamptz, NOW()), NOW())`,
      [
        id,
        input.tenantId,
        input.projectId || null,
        input.title || `Listing ${id}`,
        `LISTING-${id.slice(0, 8)}`,
        input.createdAt || null,
      ],
    );
    return id;
  }

  async function configureSelector(
    tenantId: string,
    options: {
      postsPerDay?: number;
      recycleAfterDays?: number;
      platforms?: string[];
    } = {},
  ) {
    await upsertAutoPostingSettings(setupPool, tenantId, {
      enabled: true,
      postsPerDay: options.postsPerDay ?? 1,
      recycleAfterDays: options.recycleAfterDays ?? 7,
      platforms: options.platforms ?? ['FACEBOOK_PAGE'],
      timeWindows: [{ start: '00:00', end: '23:59' }],
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
          kind: platform === 'ZALO_BROADCAST' ? 'BROADCAST' : 'PUBLIC_POST',
          status: configured.status,
          canPublish: configured.status === 'READY',
          messagingSupported: true,
          reason: configured.reason,
          retryable: configured.retryable,
          requiresConnection: true,
        };
      },
    );
  }

  beforeAll(async () => {
    schema = `auto_posting_selector_${process.pid}_${Date.now()}`;
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
    setupClient.release();
    setupClient = undefined;
  });

  beforeEach(async () => {
    await query('TRUNCATE social_publication_events, social_publications, auto_posting_settings, listings, projects CASCADE');
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

  it('selects only the current tenant and prioritizes its featured project', async () => {
    const featuredProjectA = await insertProject({
      tenantId: tenantA,
      name: 'Tenant A featured project',
      featured: true,
      priority: 1,
    });
    const otherTenantFeaturedProject = await insertProject({
      tenantId: tenantB,
      name: 'Tenant B featured project',
      featured: true,
      priority: 999,
    });
    const regularListingA = await insertListing({ tenantId: tenantA });
    const featuredListingA = await insertListing({ tenantId: tenantA, projectId: featuredProjectA });
    const leakedListingB = await insertListing({ tenantId: tenantB, projectId: otherTenantFeaturedProject });
    await configureSelector(tenantA);
    configureCapabilities({
      FACEBOOK_PAGE: { status: 'READY', reason: 'Facebook đã xác minh', retryable: false },
    });

    const result = await runAutoPostingForTenant(setupPool, tenantA);

    expect(result).toMatchObject({ created: 1, reason: 'OK' });
    const publications = await query(
      `SELECT tenant_id, listing_id, source FROM social_publications`,
    );
    expect(publications.rows).toEqual([{
      tenant_id: tenantA,
      listing_id: featuredListingA,
      source: 'AUTO',
    }]);
    expect(publications.rows.map(row => row.listing_id)).not.toContain(regularListingA);
    expect(publications.rows.map(row => row.listing_id)).not.toContain(leakedListingB);
  });

  it('recycles a listing independently per platform', async () => {
    const listingId = await insertListing({ tenantId: tenantA });
    await configureSelector(tenantA, {
      postsPerDay: 2,
      recycleAfterDays: 7,
      platforms: allPlatforms,
    });
    configureCapabilities({
      FACEBOOK_PAGE: { status: 'READY', reason: 'Facebook đã xác minh', retryable: false },
      ZALO_BROADCAST: { status: 'READY', reason: 'Zalo đã xác minh', retryable: false },
    });

    const previousPublication = await createSocialPublication(setupPool, {
      tenantId: tenantA,
      listingId,
      createdBy: null,
      publishMode: 'NOW',
      scheduledAt: null,
      contentSnapshot: { title: 'previous Facebook draft' },
      assetSnapshot: [],
      platforms: ['FACEBOOK_PAGE'],
      source: 'AUTO',
      autoPostingKey: `previous:${randomUUID()}`,
    });
    await query(
      `UPDATE social_publications SET created_at = NOW() - INTERVAL '1 day' WHERE id = $1`,
      [previousPublication.id],
    );

    const result = await runAutoPostingForTenant(setupPool, tenantA);

    expect(result).toMatchObject({ created: 1, reason: 'OK' });
    const publications = await query(
      `SELECT id, listing_id, source FROM social_publications ORDER BY created_at`,
    );
    expect(publications.rows).toHaveLength(2);
    const newPublicationId = publications.rows.find(row => row.id !== previousPublication.id)?.id;
    const newPublication = await findSocialPublication(setupPool, tenantA, newPublicationId);
    expect(newPublication?.targets.map(target => target.platform)).toEqual(['ZALO_BROADCAST']);
    expect(newPublication?.events.find(event => event.eventType === 'AUTO_PLATFORM_SKIPPED')).toMatchObject({
      reason: expect.stringContaining('FACEBOOK_PAGE'),
      metadata: {
        platform: 'FACEBOOK_PAGE',
        recycleAfterDays: 7,
      },
    });
  });

  it('creates a Facebook draft when Zalo is not ready and records the safe skip reason', async () => {
    const listingId = await insertListing({ tenantId: tenantA });
    const zaloReason = 'Zalo broadcast/public chưa xác minh quyền đăng';
    await configureSelector(tenantA, { platforms: allPlatforms });
    configureCapabilities({
      FACEBOOK_PAGE: { status: 'READY', reason: 'Facebook đã xác minh', retryable: false },
      ZALO_BROADCAST: { status: 'NOT_READY', reason: zaloReason, retryable: false },
    });

    const result = await runAutoPostingForTenant(setupPool, tenantA);

    expect(result).toMatchObject({ created: 1, reason: 'OK' });
    const publicationRow = await query(
      `SELECT id, tenant_id, listing_id, status, source
         FROM social_publications WHERE listing_id = $1`,
      [listingId],
    );
    expect(publicationRow.rows).toHaveLength(1);
    expect(publicationRow.rows[0]).toMatchObject({
      tenant_id: tenantA,
      listing_id: listingId,
      status: 'DRAFT',
      source: 'AUTO',
    });
    const publication = await findSocialPublication(setupPool, tenantA, publicationRow.rows[0].id);
    expect(publication?.targets.map(target => target.platform)).toEqual(['FACEBOOK_PAGE']);
    expect(publication?.events).toContainEqual(expect.objectContaining({
      eventType: 'AUTO_PLATFORM_SKIPPED',
      reason: `Bỏ qua ZALO_BROADCAST: ${zaloReason}`,
      metadata: {
        source: 'AUTO',
        platform: 'ZALO_BROADCAST',
        reasonCode: zaloReason,
        retryable: false,
      },
    }));
  });

  it('stops at posts_per_day when the selector runs again on the same day', async () => {
    await insertListing({ tenantId: tenantA });
    await insertListing({ tenantId: tenantA });
    await configureSelector(tenantA, { postsPerDay: 1 });
    configureCapabilities({
      FACEBOOK_PAGE: { status: 'READY', reason: 'Facebook đã xác minh', retryable: false },
    });
    const now = new Date();

    const firstRun = await runAutoPostingForTenant(setupPool, tenantA, now);
    const secondRun = await runAutoPostingForTenant(setupPool, tenantA, now);

    expect(firstRun).toMatchObject({ created: 1, reason: 'OK' });
    expect(secondRun).toEqual({
      created: 0,
      skipped: 0,
      reason: 'DAILY_LIMIT_REACHED',
    });
    const count = await query(
      `SELECT COUNT(*)::int AS count
         FROM social_publications
        WHERE tenant_id = $1 AND source = 'AUTO'`,
      [tenantA],
    );
    expect(count.rows[0].count).toBe(1);
  });

  it('uses the same Vietnam day for the quota and auto-posting key across midnight', async () => {
    const alreadyPostedListingId = await insertListing({ tenantId: tenantA });
    const nextListingId = await insertListing({ tenantId: tenantA });
    await configureSelector(tenantA, {
      postsPerDay: 1,
      recycleAfterDays: 3650,
    });
    configureCapabilities({
      FACEBOOK_PAGE: { status: 'READY', reason: 'Facebook đã xác minh', retryable: false },
    });

    const previousDayPublication = await createSocialPublication(setupPool, {
      tenantId: tenantA,
      listingId: alreadyPostedListingId,
      createdBy: null,
      publishMode: 'NOW',
      scheduledAt: null,
      contentSnapshot: { title: 'previous day draft' },
      assetSnapshot: [],
      platforms: ['FACEBOOK_PAGE'],
      source: 'AUTO',
      autoPostingKey: `2026-01-02:${alreadyPostedListingId}`,
    });
    await query(
      `UPDATE social_publications
          SET created_at = $2::timestamptz
        WHERE id = $1`,
      [previousDayPublication.id, '2026-01-02T16:59:59.999Z'],
    );

    const beforeMidnight = await runAutoPostingForTenant(
      setupPool,
      tenantA,
      new Date('2026-01-02T16:59:59.999Z'),
    );
    expect(beforeMidnight).toEqual({
      created: 0,
      skipped: 0,
      reason: 'DAILY_LIMIT_REACHED',
    });

    const afterMidnight = await runAutoPostingForTenant(
      setupPool,
      tenantA,
      new Date('2026-01-02T17:00:00.000Z'),
    );
    expect(afterMidnight).toMatchObject({ created: 1, reason: 'OK' });

    const newPublication = await query(
      `SELECT listing_id, auto_posting_key
         FROM social_publications
        WHERE tenant_id = $1 AND listing_id = $2 AND source = 'AUTO'`,
      [tenantA, nextListingId],
    );
    expect(newPublication.rows).toEqual([{
      listing_id: nextListingId,
      auto_posting_key: `2026-01-03:${nextListingId}`,
    }]);
  });

  it('does not create a duplicate draft on a same-day rerun when recycle is disabled', async () => {
    const listingId = await insertListing({ tenantId: tenantA });
    await configureSelector(tenantA, {
      postsPerDay: 2,
      recycleAfterDays: 0,
    });
    configureCapabilities({
      FACEBOOK_PAGE: { status: 'READY', reason: 'Facebook đã xác minh', retryable: false },
    });
    const now = new Date();

    const firstRun = await runAutoPostingForTenant(setupPool, tenantA, now);
    const secondRun = await runAutoPostingForTenant(setupPool, tenantA, now);

    expect(firstRun).toMatchObject({ created: 1, reason: 'OK' });
    expect(secondRun).toMatchObject({ created: 0, reason: 'OK' });
    const duplicateKeys = await query(
      `SELECT COUNT(*)::int AS count, COUNT(DISTINCT auto_posting_key)::int AS distinct_count
         FROM social_publications
        WHERE tenant_id = $1 AND listing_id = $2 AND source = 'AUTO'`,
      [tenantA, listingId],
    );
    expect(duplicateKeys.rows[0]).toEqual({ count: 1, distinct_count: 1 });
  });

  it('loads publication history with UUID listing tenants and keeps tenant boundaries', async () => {
    const listingA = await insertListing({
      tenantId: tenantA,
      title: 'Tenant A listing',
    });
    const listingB = await insertListing({
      tenantId: tenantB,
      title: 'Tenant B listing',
    });

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
    const tenantACount = await countSocialPublications(setupPool, tenantA);
    const tenantBPublications = await listSocialPublications(setupPool, tenantB);
    const tenantBCount = await countSocialPublications(setupPool, tenantB);

    expect(tenantAPublications).toHaveLength(1);
    expect(tenantAPublications[0]).toMatchObject({
      tenantId: tenantA,
      listingId: listingA,
      listingReview: {
        eligible: true,
        listingExists: true,
        listingCode: expect.stringContaining('LISTING-'),
        listingTitle: 'Tenant A listing',
      },
    });
    expect(tenantACount).toBe(1);
    expect(tenantBPublications).toHaveLength(1);
    expect(tenantBPublications[0]).toMatchObject({
      tenantId: tenantB,
      listingId: listingB,
      listingReview: {
        eligible: true,
        listingExists: true,
        listingTitle: 'Tenant B listing',
      },
    });
    expect(tenantBCount).toBe(1);
    expect(tenantAPublications.map(publication => publication.tenantId)).not.toContain(tenantB);
    expect(tenantBPublications.map(publication => publication.tenantId)).not.toContain(tenantA);
  });
});

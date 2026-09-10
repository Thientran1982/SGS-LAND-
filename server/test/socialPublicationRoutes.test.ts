import express from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  buildSocialProductSnapshot: vi.fn(),
  buildSocialProjectSnapshot: vi.fn(),
  createSocialPublication: vi.fn(),
  encodeSocialPublicationCursor: vi.fn(({ createdAt, id }: { createdAt: string; id: string }) => (
    Buffer.from(JSON.stringify({ createdAt, id }), 'utf8').toString('base64url')
  )),
  recordSocialPublicationEvent: vi.fn(),
  listSocialPublications: vi.fn(),
  countSocialPublications: vi.fn(),
  getTenantPublicationCatalog: vi.fn(),
}));

vi.mock('../repositories/listingRepository', () => ({
  listingRepository: { findById: mocks.findById },
}));

vi.mock('../repositories/socialPublicationRepository', () => ({
  createSocialPublication: mocks.createSocialPublication,
  encodeSocialPublicationCursor: mocks.encodeSocialPublicationCursor,
  recordSocialPublicationEvent: mocks.recordSocialPublicationEvent,
  listSocialPublications: mocks.listSocialPublications,
  countSocialPublications: mocks.countSocialPublications,
  findSocialPublication: vi.fn(),
  activateSocialPublication: vi.fn(),
  cancelSocialPublication: vi.fn(),
  markSocialTargetsPending: vi.fn(),
  applySocialTargetOperatorAction: vi.fn(),
}));

vi.mock('../services/socialPublicationService', () => ({
  MAX_FACEBOOK_IMAGES: 10,
  normalizeSocialPlatforms: (input: unknown) => (
    Array.isArray(input)
      ? input.map(value => String(value).toUpperCase()).filter((value, index, values) => (
        ['FACEBOOK_PAGE', 'ZALO_BROADCAST'].includes(value) && values.indexOf(value) === index
      ))
      : []
  ),
  normalizePublicationImages: (input: unknown) => (
    Array.isArray(input)
      ? input.filter(value => typeof value === 'string' && value.startsWith('https://'))
      : []
  ),
  normalizePublicationCaption: (input: unknown) => (
    typeof input === 'string' && input.trim() ? input.trim() : null
  ),
  buildSocialProductSnapshot: mocks.buildSocialProductSnapshot,
  buildSocialProjectSnapshot: mocks.buildSocialProjectSnapshot,
  buildPlatformContent: (snapshot: any, platform: string, imageUrls: string[]) => ({
    platform,
    title: snapshot.title,
    text: snapshot.caption || `${snapshot.title} preview`,
    imageUrls,
    link: snapshot.publicUrl || null,
  }),
  getTenantPublicationCatalog: mocks.getTenantPublicationCatalog,
}));

vi.mock('../social-publishing/registry', () => ({
  getTenantSocialPlatformCapability: vi.fn(),
}));

import { createSocialPublicationRouter } from '../routes/socialPublicationRoutes';

const tenantId = 'tenant-route-test';
const listingId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const imageUrl = 'https://cdn.example.test/listing-1.jpg';

function baseListing() {
  return {
    id: listingId,
    title: 'Nhà phố ven sông',
    status: 'AVAILABLE',
    images: [imageUrl],
  };
}

function baseSnapshot() {
  return {
    version: 1,
    listingId,
    title: 'Nhà phố ven sông',
    publicUrl: 'https://sgsland.example/p/SGS-001',
    status: 'AVAILABLE',
    capturedAt: '2026-09-10T00:00:00.000Z',
  };
}

function baseProjectSnapshot() {
  return {
    version: 1,
    projectId,
    code: 'PRJ-001',
    title: 'Khu đô thị ven sông',
    description: 'Không gian sống xanh.',
    location: 'Thủ Đức, TP.HCM',
    totalUnits: 1200,
    status: 'ACTIVE',
    priceLabel: 'Liên hệ',
    images: [imageUrl],
    publicUrl: 'https://sgsland.example/du-an/PRJ-001',
    capturedAt: '2026-09-10T00:00:00.000Z',
  };
}

async function startTestServer(): Promise<{ server: Server; origin: string }> {
  const app = express();
  app.use(express.json());
  app.use(createSocialPublicationRouter({} as any, ((req: any, _res: any, next: any) => {
    req.user = { id: 'operator-1', tenantId, role: 'MARKETING' };
    next();
  }) as any));

  const server = await new Promise<Server>(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a port');
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

async function request(origin: string, path: string, body?: unknown) {
  const response = await fetch(`${origin}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json(),
  };
}

describe('social publication preview and draft routes', () => {
  let server: Server;
  let origin: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.findById.mockResolvedValue(baseListing());
    mocks.buildSocialProductSnapshot.mockResolvedValue(baseSnapshot());
    mocks.buildSocialProjectSnapshot.mockResolvedValue(baseProjectSnapshot());
    mocks.getTenantPublicationCatalog.mockResolvedValue([]);
    mocks.listSocialPublications.mockResolvedValue([]);
    mocks.countSocialPublications.mockResolvedValue(0);
    mocks.createSocialPublication.mockImplementation(async (_pool, input) => ({
      id: 'publication-1',
      listingId: input.listingId,
      status: 'DRAFT',
      publishMode: input.publishMode,
      scheduledAt: input.scheduledAt,
      contentSnapshot: input.contentSnapshot,
      assetSnapshot: input.assetSnapshot,
      targets: input.platforms.map((platform: string) => ({
        id: `target-${platform}`,
        platform,
        status: 'NOT_READY',
      })),
    }));
    ({ server, origin } = await startTestServer());
  });

  afterEach(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it('previews every selected platform with the approved caption and images', async () => {
    const result = await request(origin, '/api/social-publications/preview', {
      listingId,
      platforms: ['FACEBOOK_PAGE', 'ZALO_BROADCAST'],
      caption: 'Caption đã duyệt',
      imageUrls: [imageUrl],
    });

    expect(result.status).toBe(200);
    expect(result.body.previews).toEqual([
      expect.objectContaining({
        platform: 'FACEBOOK_PAGE',
        text: 'Caption đã duyệt',
        imageUrls: [imageUrl],
      }),
      expect.objectContaining({
        platform: 'ZALO_BROADCAST',
        text: 'Caption đã duyệt',
        imageUrls: [imageUrl],
      }),
    ]);
  });

  it('saves one DRAFT with one target per selected platform and records the event', async () => {
    const result = await request(origin, '/api/social-publications', {
      listingId,
      platforms: ['FACEBOOK_PAGE', 'ZALO_BROADCAST'],
      publishMode: 'NOW',
      caption: 'Caption đã duyệt',
      imageUrls: [imageUrl],
    });

    expect(result.status).toBe(201);
    expect(result.body.status).toBe('DRAFT');
    expect(result.body.targets.map((target: any) => target.platform)).toEqual([
      'FACEBOOK_PAGE',
      'ZALO_BROADCAST',
    ]);
    expect(mocks.createSocialPublication).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId,
        listingId,
        platforms: ['FACEBOOK_PAGE', 'ZALO_BROADCAST'],
        contentSnapshot: expect.objectContaining({ caption: 'Caption đã duyệt' }),
        assetSnapshot: [imageUrl],
      }),
    );
    expect(mocks.recordSocialPublicationEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'DRAFT_CREATED',
        toStatus: 'DRAFT',
        metadata: { platforms: ['FACEBOOK_PAGE', 'ZALO_BROADCAST'] },
      }),
    );
  });

  it('previews a project without looking up a listing and preserves the project source', async () => {
    const result = await request(origin, '/api/social-publications/preview', {
      projectId,
      platforms: ['FACEBOOK_PAGE'],
      caption: 'Caption dự án đã duyệt',
      imageUrls: [imageUrl],
    });

    expect(result.status).toBe(200);
    expect(result.body.snapshot).toMatchObject({ projectId, title: 'Khu đô thị ven sông' });
    expect(result.body.previews[0]).toMatchObject({
      title: 'Khu đô thị ven sông',
      text: 'Caption dự án đã duyệt',
      imageUrls: [imageUrl],
    });
    expect(mocks.findById).not.toHaveBeenCalled();
    expect(mocks.buildSocialProjectSnapshot).toHaveBeenCalledWith(tenantId, projectId);
  });

  it('creates a project draft with projectId and rejects a request with both sources', async () => {
    const projectResult = await request(origin, '/api/social-publications', {
      projectId,
      platforms: ['FACEBOOK_PAGE'],
      publishMode: 'NOW',
      caption: 'Caption dự án',
      imageUrls: [imageUrl],
    });

    expect(projectResult.status).toBe(201);
    expect(mocks.createSocialPublication).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId,
        listingId: null,
        projectId,
        contentSnapshot: expect.objectContaining({ projectId }),
      }),
    );

    const invalidResult = await request(origin, '/api/social-publications/preview', {
      listingId,
      projectId,
      platforms: ['FACEBOOK_PAGE'],
    });
    expect(invalidResult.status).toBe(400);
    expect(invalidResult.body.error).toContain('đúng một nguồn');
  });

  it('does not create a Zalo draft without a public HTTPS image', async () => {
    mocks.findById.mockResolvedValue({ ...baseListing(), images: [] });

    const result = await request(origin, '/api/social-publications', {
      listingId,
      platforms: ['ZALO_BROADCAST'],
      publishMode: 'NOW',
      caption: 'Thiếu ảnh',
      imageUrls: [],
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toContain('ZALO_BROADCAST');
    expect(mocks.createSocialPublication).not.toHaveBeenCalled();
  });

  it('lists stale publication links with the tenant-scoped filter', async () => {
    mocks.listSocialPublications.mockResolvedValue([{
      id: 'publication-stale',
      listingId,
      listingReview: {
        eligible: false,
        listingExists: true,
        listingStatus: 'SOLD',
        reason: 'LISTING_STATUS_NOT_ELIGIBLE',
      },
    }]);
    mocks.countSocialPublications.mockResolvedValue(1);

    const result = await request(
      origin,
      '/api/social-publications?source=MANUAL&staleOnly=true&limit=200',
    );

    expect(result.status).toBe(200);
    expect(result.body.data).toHaveLength(1);
    expect(result.body).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 200,
      totalPages: 1,
      hasNext: false,
    });
    expect(mocks.listSocialPublications).toHaveBeenCalledWith(
      expect.anything(),
      tenantId,
      200,
      'MANUAL',
      true,
    );
  });

  it('returns the requested stale-only page and total count', async () => {
    mocks.listSocialPublications.mockResolvedValue([{
      id: 'publication-stale-page-2',
      listingId,
      listingReview: {
        eligible: false,
        listingExists: false,
        listingStatus: null,
        reason: 'LISTING_NOT_FOUND',
      },
    }]);
    mocks.countSocialPublications.mockResolvedValue(51);

    const result = await request(
      origin,
      '/api/social-publications?staleOnly=true&page=2&pageSize=25',
    );

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      total: 51,
      page: 2,
      pageSize: 25,
      totalPages: 3,
      hasNext: true,
    });
    expect(mocks.listSocialPublications).toHaveBeenCalledWith(
      expect.anything(),
      tenantId,
      25,
      undefined,
      true,
      25,
    );
    expect(mocks.countSocialPublications).toHaveBeenCalledWith(
      expect.anything(),
      tenantId,
      undefined,
      true,
    );
  });

  it('uses a tenant-scoped stale cursor when data changes between operator page loads', async () => {
    const firstPage = [
      {
        id: 'publication-stale-newest',
        listingId,
        createdAt: '2026-09-10T03:00:00.000Z',
        listingReview: { eligible: false, listingExists: true, listingStatus: 'SOLD' },
      },
      {
        id: 'publication-stale-boundary',
        listingId,
        createdAt: '2026-09-10T02:00:00.000Z',
        listingReview: { eligible: false, listingExists: true, listingStatus: 'SOLD' },
      },
    ];
    const secondPage = [
      {
        id: 'publication-stale-older-1',
        listingId,
        createdAt: '2026-09-10T01:00:00.000Z',
        listingReview: { eligible: false, listingExists: false, listingStatus: null },
      },
      {
        id: 'publication-stale-older-2',
        listingId,
        createdAt: '2026-09-10T00:00:00.000Z',
        listingReview: { eligible: false, listingExists: false, listingStatus: null },
      },
    ];
    let cursor: string | undefined;
    mocks.listSocialPublications.mockImplementation(async (
      _pool,
      requestedTenantId,
      _limit,
      _source,
      staleOnly,
      offset,
      requestedCursor,
    ) => {
      expect(requestedTenantId).toBe(tenantId);
      expect(staleOnly).toBe(true);
      if (!requestedCursor) {
        expect(offset).toBeUndefined();
        cursor = mocks.encodeSocialPublicationCursor(firstPage[1]);
        return firstPage;
      }
      expect(offset).toBe(0);
      expect(requestedCursor).toBe(cursor);
      // A newer stale publication was inserted and the boundary listing
      // became eligible after page one. The cursor must still return the
      // older original rows instead of repeating or skipping them.
      return secondPage;
    });
    mocks.countSocialPublications.mockResolvedValue(4);

    const firstResult = await request(
      origin,
      '/api/social-publications?staleOnly=true&page=1&pageSize=2',
    );
    const nextCursor = firstResult.body.nextCursor;
    const secondResult = await request(
      origin,
      `/api/social-publications?staleOnly=true&page=2&pageSize=2&cursor=${encodeURIComponent(nextCursor)}`,
    );

    expect(firstResult.status).toBe(200);
    expect(secondResult.status).toBe(200);
    expect(firstResult.body.data.map((row: any) => row.id)).toEqual([
      'publication-stale-newest',
      'publication-stale-boundary',
    ]);
    expect(secondResult.body.data.map((row: any) => row.id)).toEqual([
      'publication-stale-older-1',
      'publication-stale-older-2',
    ]);
    expect([
      ...firstResult.body.data,
      ...secondResult.body.data,
    ].map((row: any) => row.id)).toEqual([
      'publication-stale-newest',
      'publication-stale-boundary',
      'publication-stale-older-1',
      'publication-stale-older-2',
    ]);
    expect(mocks.listSocialPublications).toHaveBeenLastCalledWith(
      expect.anything(),
      tenantId,
      2,
      undefined,
      true,
      0,
      nextCursor,
    );
  });
});
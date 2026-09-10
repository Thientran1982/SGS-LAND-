import express from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  buildSocialProductSnapshot: vi.fn(),
  createSocialPublication: vi.fn(),
  recordSocialPublicationEvent: vi.fn(),
  listSocialPublications: vi.fn(),
  getTenantPublicationCatalog: vi.fn(),
}));

vi.mock('../repositories/listingRepository', () => ({
  listingRepository: { findById: mocks.findById },
}));

vi.mock('../repositories/socialPublicationRepository', () => ({
  createSocialPublication: mocks.createSocialPublication,
  recordSocialPublicationEvent: mocks.recordSocialPublicationEvent,
  listSocialPublications: mocks.listSocialPublications,
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
    mocks.getTenantPublicationCatalog.mockResolvedValue([]);
    mocks.listSocialPublications.mockResolvedValue([]);
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
});
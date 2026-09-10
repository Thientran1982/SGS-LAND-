import express from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findListings: vi.fn(),
  findListingsCursor: vi.fn(),
  findListingsForPartner: vi.fn(),
  auditRepository: {},
  invalidateListingCache: vi.fn(),
  priceCalibrationService: {},
  notificationRepository: { create: vi.fn() },
  storeFile: vi.fn(),
}));

vi.mock('../repositories/listingRepository', () => ({
  listingRepository: {
    findListings: mocks.findListings,
    findListingsCursor: mocks.findListingsCursor,
    findListingsForPartner: mocks.findListingsForPartner,
  },
}));
vi.mock('../repositories/auditRepository', () => ({ auditRepository: mocks.auditRepository }));
vi.mock('../services/cacheInvalidationService', () => ({
  invalidateListingCache: mocks.invalidateListingCache,
}));
vi.mock('../services/priceCalibrationService', () => ({
  priceCalibrationService: mocks.priceCalibrationService,
}));
vi.mock('../repositories/notificationRepository', () => ({
  notificationRepository: mocks.notificationRepository,
}));
vi.mock('../services/storageService', () => ({ storeFile: mocks.storeFile }));

import { createListingRoutes } from '../routes/listingRoutes';

const tenantId = 'tenant-listing-route-test';
const userId = 'user-listing-route-test';
const eligibleStatuses = ['AVAILABLE', 'OPENING', 'BOOKING', 'BEST_MARKET'];
const listingResult = {
  data: [],
  total: 0,
  page: 1,
  pageSize: 100,
  totalPages: 0,
};
const cursorListingResult = {
  data: [],
  nextCursor: null,
  hasNext: false,
  total: 0,
  stats: {},
};

async function startTestServer(): Promise<{ server: Server; origin: string }> {
  const app = express();
  app.use('/api/listings', createListingRoutes(((req: any, _res: any, next: any) => {
    req.user = { id: userId, tenantId, role: 'ADMIN' };
    next();
  }) as any));

  const server = await new Promise<Server>(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a port');
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

describe('listing status filters', () => {
  let server: Server;
  let origin: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.findListings.mockResolvedValue(listingResult);
    mocks.findListingsCursor.mockResolvedValue(cursorListingResult);
    ({ server, origin } = await startTestServer());
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve())),
    );
  });

  it('passes plural status filters as status_in for offset pagination', async () => {
    const response = await fetch(
      `${origin}/api/listings?page=2&pageSize=25&statuses=${eligibleStatuses.join(',')}`,
    );

    expect(response.status).toBe(200);
    expect(mocks.findListings).toHaveBeenCalledWith(
      tenantId,
      { page: 2, pageSize: 25 },
      { status_in: eligibleStatuses },
      userId,
      'ADMIN',
    );
    expect(mocks.findListingsCursor).not.toHaveBeenCalled();
  });

  it('passes plural status filters as status_in for cursor pagination', async () => {
    const response = await fetch(
      `${origin}/api/listings?cursorMode=true&pageSize=25&cursor=cursor-token&statuses=${eligibleStatuses.join(',')}`,
    );

    expect(response.status).toBe(200);
    expect(mocks.findListingsCursor).toHaveBeenCalledWith(tenantId, {
      pageSize: 25,
      cursor: 'cursor-token',
      filters: { status_in: eligibleStatuses },
      userId,
      userRole: 'ADMIN',
    });
    expect(mocks.findListings).not.toHaveBeenCalled();
  });

  it('converts a comma-separated singular status filter to status_in for compatibility', async () => {
    const response = await fetch(
      `${origin}/api/listings?status=${eligibleStatuses.join(',')}`,
    );

    expect(response.status).toBe(200);
    expect(mocks.findListings).toHaveBeenCalledWith(
      tenantId,
      { page: 1, pageSize: 20 },
      { status_in: eligibleStatuses },
      userId,
      'ADMIN',
    );
  });
});
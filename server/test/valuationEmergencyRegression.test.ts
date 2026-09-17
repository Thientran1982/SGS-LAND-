import express from 'express';
import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { applyAVM } from '../valuationEngine';

const {
  dbQuery,
  withRlsBypass,
  marketDataGet,
  startAgentRun,
  finishAgentRun,
  findPublicTeaserListing,
} = vi.hoisted(() => ({
  dbQuery: vi.fn(),
  withRlsBypass: vi.fn(),
  marketDataGet: vi.fn(),
  startAgentRun: vi.fn(),
  finishAgentRun: vi.fn(),
  findPublicTeaserListing: vi.fn(),
}));

vi.mock('../db', () => ({
  pool: { query: dbQuery },
  withRlsBypass,
}));
vi.mock('../services/marketDataService', () => ({
  marketDataService: { getMarketData: marketDataGet },
}));
vi.mock('../services/agentRunsService', () => ({
  startAgentRun,
  finishAgentRun,
}));
vi.mock('../repositories/listingRepository', () => ({
  listingRepository: { findPublicTeaserListing },
}));

describe('valuation emergency regressions', () => {
  it('keeps AVM market prices in VNĐ/m² instead of clamping them to 100,000', () => {
    const result = applyAVM({
      marketBasePrice: 100_000_000,
      area: 80,
      roadWidth: 4,
      legal: 'PINK_BOOK',
      confidence: 80,
      marketTrend: 'stable',
      propertyType: 'townhouse_center',
    });

    expect(result.pricePerM2).toBe(100_000_000);
    expect(result.totalPrice).toBe(8_000_000_000);
  });

  it('still rejects non-finite market prices without poisoning the output', () => {
    const result = applyAVM({
      marketBasePrice: Number.NaN,
      area: 80,
      roadWidth: 4,
      legal: 'PINK_BOOK',
      confidence: 80,
      marketTrend: 'stable',
      propertyType: 'townhouse_center',
    });

    expect(Number.isFinite(result.pricePerM2)).toBe(true);
    expect(Number.isFinite(result.totalPrice)).toBe(true);
    expect(result.pricePerM2).toBe(0);
  });
});

describe('public valuation teaser boundaries', () => {
  let server: http.Server;
  let origin: string;

  beforeEach(async () => {
    dbQuery.mockReset();
    dbQuery.mockResolvedValue({ rows: [] });
    findPublicTeaserListing.mockReset();

    const { createValuationRoutes } = await import('../routes/valuationRoutes');
    const app = express();
    app.use('/api/valuation', createValuationRoutes(
      (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
      (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
      (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
      (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    ));
    server = await new Promise<http.Server>(resolve => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not expose a port');
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it('does not resolve a private listing id on the public teaser', async () => {
    const response = await fetch(
      `${origin}/api/valuation/teaser?listing_id=42&location=Quan%201&area=80`,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'listing_id is not supported on the public teaser; use listing_token',
    });
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it('rejects an invalid public listing token without querying listing data', async () => {
    const response = await fetch(
      `${origin}/api/valuation/teaser?listing_token=not-a-signed-token`,
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Public listing not found' });
    expect(findPublicTeaserListing).not.toHaveBeenCalled();
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it('rejects a valid token when the listing is private or belongs to another tenant', async () => {
    const { createPublicListingTeaserToken } = await import('../services/publicListingTeaserCapability');
    const token = createPublicListingTeaserToken({
      tenantId: 'private-tenant',
      listingId: 'private-listing',
    });
    findPublicTeaserListing.mockResolvedValue(null);

    const response = await fetch(
      `${origin}/api/valuation/teaser?listing_token=${encodeURIComponent(token)}`,
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Public listing not found' });
    expect(findPublicTeaserListing).toHaveBeenCalledWith('private-tenant', 'private-listing');
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it('fails closed if a public lookup ever returns a row outside the token scope', async () => {
    const { createPublicListingTeaserToken } = await import('../services/publicListingTeaserCapability');
    const token = createPublicListingTeaserToken({
      tenantId: 'tenant-a',
      listingId: 'listing-a',
    });
    findPublicTeaserListing.mockResolvedValue({
      tenantId: 'tenant-b',
      listingId: 'listing-b',
      location: 'Private address',
      area: 999,
      type: 'LAND',
    });

    const response = await fetch(
      `${origin}/api/valuation/teaser?listing_token=${encodeURIComponent(token)}`,
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Public listing not found' });
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it('resolves only server-owned inputs for a valid explicitly public listing token', async () => {
    const { createPublicListingTeaserToken } = await import('../services/publicListingTeaserCapability');
    const token = createPublicListingTeaserToken({
      tenantId: 'public-tenant',
      listingId: 'public-listing',
    });
    findPublicTeaserListing.mockResolvedValue({
      tenantId: 'public-tenant',
      listingId: 'public-listing',
      location: 'Quận 1, TP.HCM',
      area: 80,
      type: 'APARTMENT',
    });

    const response = await fetch(
      `${origin}/api/valuation/teaser?listing_token=${encodeURIComponent(token)}&location=private-address&area=9999&type=land`,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.locationDisplay).toBe('Quận 1, TP.HCM');
    expect(body.area).toBe(80);
    expect(body.internalCompsCount).toBe(0);
    expect(findPublicTeaserListing).toHaveBeenCalledWith('public-tenant', 'public-listing');
    expect(dbQuery).toHaveBeenCalledOnce();
    expect(dbQuery.mock.calls[0][1]).toEqual([
      'quan 1 tp hcm',
      'apartment_center',
      'VND_PER_M2',
    ]);
  });

  it('uses only global, property-type-matched history and never queries listings', async () => {
    await fetch(
      `${origin}/api/valuation/teaser?location=Quan%201%2C%20TP.HCM&area=80&type=apartment_center`,
    );

    expect(dbQuery).toHaveBeenCalledOnce();
    const [sql, params] = dbQuery.mock.calls[0];
    expect(sql).toContain('tenant_id IS NULL');
    expect(sql).toContain('property_type = $2');
    expect(sql).not.toMatch(/\bFROM listings\b/i);
    expect(params).toEqual([
      'quan 1 tp hcm',
      'apartment_center',
      'VND_PER_M2',
    ]);
  });
});

describe('listing price refresh persistence', () => {
  it('updates the listing with parameterized price and id values', async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({
        rows: [{
          id: 'listing-1',
          tenant_id: 'tenant-1',
          title: 'Apartment',
          location: 'Quận 1, TP.HCM',
          type: 'apartment',
          price: '1000000000',
          area: '80',
          attributes: {},
          project_code: null,
        }],
      })
      .mockResolvedValueOnce({ rows: [] });
    withRlsBypass.mockImplementation(async (callback: (client: unknown) => unknown) =>
      callback({ query: clientQuery }),
    );
    marketDataGet.mockResolvedValue({
      pricePerM2: 100_000_000,
      isTypeSpecific: true,
      propertyType: 'apartment_center',
      confidence: 80,
      marketTrend: 'stable',
    });
    startAgentRun.mockResolvedValue('run-1');
    finishAgentRun.mockResolvedValue(undefined);

    const { createListingPriceRefreshRouter } = await import('../routes/listingPriceRefreshRoutes');
    const app = express().use(express.json()).use(createListingPriceRefreshRouter(
      { query: vi.fn().mockResolvedValue({ rows: [] }) } as any,
      'cron-secret',
    ));
    const server = http.createServer(app);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not expose a port');

    try {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/internal/listing-price-refresh`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-internal-secret': 'cron-secret' },
          body: JSON.stringify({ threshold: 0 }),
        },
      );

      expect(response.status).toBe(200);
      const updateCall = clientQuery.mock.calls[1];
      expect(updateCall[0]).toContain('SET price = $1');
      expect(updateCall[0]).toContain('WHERE id = $2');
      const expected = applyAVM({
        marketBasePrice: 100_000_000,
        area: 80,
        roadWidth: 6,
        legal: 'CONTRACT',
        confidence: 80,
        marketTrend: 'stable',
        propertyType: 'apartment_center',
        direction: 'S',
      }).totalPrice;
      expect(updateCall[1]).toEqual([expected, 'listing-1']);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
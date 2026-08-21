import express from 'express';
import http from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();

vi.mock('../db', () => ({ pool: { query } }));
vi.mock('../repositories/analyticsRepository', () => ({
  analyticsRepository: {},
}));

const { visitorRepository } = await import('../repositories/visitorRepository');
const { createAnalyticsRoutes } = await import('../routes/analyticsRoutes');

function mockFunnelQueries(row: Record<string, unknown> = {}) {
  query
    .mockResolvedValueOnce({ rows: [row] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] });
}

async function getJson(app: express.Express, path: string): Promise<{ status: number; body: any }> {
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

describe('visitor funnel with incomplete data', () => {
  beforeEach(() => query.mockReset());

  it('returns zero metrics for a tenant with no events', async () => {
    mockFunnelQueries();

    await expect(visitorRepository.getFunnelStats('tenant-a')).resolves.toMatchObject({
      propertyViews: 0,
      sessions: 0,
      engagedSessions: 0,
      pageLeaves: 0,
      averageTimeOnPageMs: 0,
    });
  });

  it('counts page views as sessions without inventing engagement or view time', async () => {
    mockFunnelQueries({ property_views: 1, sessions: 1 });

    await expect(visitorRepository.getFunnelStats('tenant-a')).resolves.toMatchObject({
      propertyViews: 1,
      sessions: 1,
      engagedSessions: 0,
      averageTimeOnPageMs: 0,
    });
  });

  it('ignores page leaves without a valid timeOnPageMs value', async () => {
    mockFunnelQueries({ page_leaves: 1, average_time_on_page_ms: null });

    await expect(visitorRepository.getFunnelStats('tenant-a')).resolves.toMatchObject({
      pageLeaves: 1,
      averageTimeOnPageMs: 0,
    });

    const funnelSql = query.mock.calls[0][0] as string;
    expect(funnelSql).toContain("event_type = 'page_leave'");
    expect(funnelSql).toContain("metadata->>'timeOnPageMs' ~ '^[0-9]+$'");
  });

  it('normalizes non-finite database metrics to zero', async () => {
    mockFunnelQueries({ sessions: 'NaN', average_time_on_page_ms: 'Infinity' });

    await expect(visitorRepository.getFunnelStats('tenant-a')).resolves.toMatchObject({
      sessions: 0,
      averageTimeOnPageMs: 0,
    });
  });
});

describe('GET /visitor-funnel access controls', () => {
  const authenticate = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as any).user = { id: 'user-1', tenantId: 'tenant-a', role: 'AGENT' };
    next();
  };

  it('passes the authenticated tenant to the repository', async () => {
    mockFunnelQueries();
    const spy = vi.spyOn(visitorRepository, 'getFunnelStats');
    const app = express().use('/api/analytics', createAnalyticsRoutes(authenticate));

    const response = await getJson(app, '/api/analytics/visitor-funnel?days=7');

    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledWith('tenant-a', 7, { projectCode: undefined, source: undefined });
    spy.mockRestore();
  });

  it('rejects partner roles before querying funnel data', async () => {
    const partnerAuth = (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
      (_req as any).user = { id: 'user-2', tenantId: 'tenant-b', role: 'PARTNER_AGENT' };
      next();
    };
    const app = express().use('/api/analytics', createAnalyticsRoutes(partnerAuth));

    const response = await getJson(app, '/api/analytics/visitor-funnel');

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('quyền');
  });
});
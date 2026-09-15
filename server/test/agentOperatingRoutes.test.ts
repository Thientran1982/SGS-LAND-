import express from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cockpitSummary: vi.fn(),
  processAgentEvents: vi.fn(),
  listBrain: vi.fn(),
  listCapabilityStatus: vi.fn(),
  cockpitPanels: ['events', 'questions', 'executions', 'audit', 'rollouts', 'weeklyKpi', 'shiftReports', 'roleCards', 'rollbackAudits'],
}));

vi.mock('../repositories/agentOperatingRepository', () => ({
  agentOperatingRepository: {
    cockpitSummary: mocks.cockpitSummary,
  },
  COCKPIT_PANELS: mocks.cockpitPanels,
}));

vi.mock('../services/agentOperatorDaemon', () => ({
  processAgentEvents: mocks.processAgentEvents,
}));

vi.mock('../repositories/companyBrainRepository', () => ({
  companyBrainRepository: {
    list: mocks.listBrain,
    listCapabilityStatus: mocks.listCapabilityStatus,
  },
}));

import { createAgentOperatingRoutes } from '../routes/agentOperatingRoutes';

async function startServer() {
  const app = express();
  app.use('/api/agent-operating', createAgentOperatingRoutes(((req: any, _res: any, next: any) => {
    req.user = { id: 'operator-1', tenantId: 'tenant-1', role: 'ADMIN' };
    next();
  }) as any));
  const server = await new Promise<Server>(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a port');
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

describe('Agent Operating cockpit route', () => {
  let server: Server;
  let origin: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.cockpitSummary.mockRejectedValue(new Error('ETIMEDOUT: timeout acquiring database connection'));
    ({ server, origin } = await startServer());
  });

  afterEach(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it('returns a degraded summary instead of 500 when the database connection times out', async () => {
    const response = await fetch(`${origin}/api/agent-operating/cockpit`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      degraded: true,
      warning: 'Dữ liệu vận hành tạm thời chưa tải được; hãy thử làm mới sau.',
      events: [],
      humanQuestions: [],
      executions: [],
      recentAudit: [],
      weeklyKpi: [],
      shiftReports: [],
      rollbackAudits: [],
      availability: Object.fromEntries(mocks.cockpitPanels.map(panel => [panel, { available: false, error: 'QUERY_FAILED' }])),
      unavailablePanels: mocks.cockpitPanels,
    });
    expect(body.roleCards.length).toBeGreaterThan(0);
    expect(body.roleCards.every((card: { approval_status?: string }) => card.approval_status === 'UNAVAILABLE')).toBe(true);
    expect(body).not.toHaveProperty('eventCount', 0);
    expect(body).not.toHaveProperty('executionCount', 0);
    expect(body).not.toHaveProperty('humanQuestionCount', 0);
  });

  it('preserves an empty panel as loaded while identifying the panel query that failed', async () => {
    mocks.cockpitSummary.mockResolvedValue({
      roleCards: [],
      events: [],
      humanQuestions: [],
      executions: [{ status: 'SUCCESS', count: 2 }],
      recentAudit: [],
      rollouts: [],
      weeklyKpi: [],
      shiftReports: [],
      rollbackAudits: [],
      generatedAt: new Date().toISOString(),
      degraded: true,
      warning: 'Một hoặc nhiều panel vận hành chưa tải được; hãy thử làm mới sau.',
      availability: {
        events: { available: true },
        questions: { available: false, error: 'QUERY_FAILED' },
        executions: { available: true },
        audit: { available: true },
        rollouts: { available: true },
        weeklyKpi: { available: true },
        shiftReports: { available: true },
        roleCards: { available: true },
        rollbackAudits: { available: true },
      },
      unavailablePanels: ['questions'],
    });

    const response = await fetch(`${origin}/api/agent-operating/cockpit`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.availability.events).toEqual({ available: true });
    expect(body.availability.questions).toEqual({ available: false, error: 'QUERY_FAILED' });
    expect(body.unavailablePanels).toEqual(['questions']);
    expect(body.humanQuestions).toEqual([]);
    expect(body.availability.weeklyKpi).toEqual({ available: true });
  });
});
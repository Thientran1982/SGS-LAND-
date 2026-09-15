import express from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cockpitSummary: vi.fn(),
  processAgentEvents: vi.fn(),
  listBrain: vi.fn(),
  listCapabilityStatus: vi.fn(),
}));

vi.mock('../repositories/agentOperatingRepository', () => ({
  agentOperatingRepository: {
    cockpitSummary: mocks.cockpitSummary,
  },
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
    });
    expect(body.roleCards.length).toBeGreaterThan(0);
    expect(body.roleCards.every((card: { approval_status?: string }) => card.approval_status === 'UNAVAILABLE')).toBe(true);
    expect(body).not.toHaveProperty('eventCount', 0);
    expect(body).not.toHaveProperty('executionCount', 0);
    expect(body).not.toHaveProperty('humanQuestionCount', 0);
  });
});
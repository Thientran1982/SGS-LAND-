import express from 'express';
import * as http from 'node:http';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticateToken, getCommandCenterSummary } = vi.hoisted(() => ({
  authenticateToken: vi.fn(),
  getCommandCenterSummary: vi.fn(),
}));

vi.mock('../services/commandCenterService', () => ({ getCommandCenterSummary }));
vi.mock('../ai/agentOrchestrationRegistry', () => ({
  AGENT_ORCHESTRATION_REGISTRY: [],
  isCompoundRoutingEnabled: vi.fn(() => false),
  validateAgentOrchestrationRegistry: vi.fn(() => []),
}));
vi.mock('../ai/minhHealth', () => ({ getMinhBrainHealth: vi.fn() }));
vi.mock('../services/minhBrainScheduler', () => ({ getMinhBrainSchedulerSnapshot: vi.fn() }));
vi.mock('../services/minhOpportunityDetectors', () => ({ listMinhOpportunities: vi.fn() }));
vi.mock('../services/minhDecisionQueueService', () => ({
  getMinhProactiveBudgetStatus: vi.fn(),
  getMinhProactiveRollout: vi.fn(),
  listMinhDecisionQueue: vi.fn(),
  suggestMinhOpportunity: vi.fn(),
}));
vi.mock('../services/minhDecisionLearningService', () => ({
  getMinhDecisionLearning: vi.fn(),
  getMinhDecisionLearningSnapshot: vi.fn(),
  getMinhDecisionLearningTrend: vi.fn(),
  listMinhLearningExports: vi.fn(),
  normalizeMinhLearningWindow: vi.fn(() => 30),
  recordMinhLearningExport: vi.fn(),
}));

import { createMinhBrainRoutes } from '../routes/minhBrainRoutes';

async function startServer(user: { role: string; tenantId: string }) {
  const app = express();
  authenticateToken.mockImplementation((_req: any, _res: any, next: any) => {
    _req.user = user;
    next();
  });
  app.use('/api/internal/minh-brain', createMinhBrainRoutes(authenticateToken));

  const server = await new Promise<Server>(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a port');
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

async function getJson(origin: string) {
  const response = await fetch(`${origin}/api/internal/minh-brain/command-center`);
  return { response, body: await response.json() };
}

describe('Minh Command Center route', () => {
  let server: Server;
  let origin: string;

  beforeEach(() => {
    vi.clearAllMocks();
    getCommandCenterSummary.mockImplementation(async (tenantId: string) => ({
      generatedAt: '2026-09-15T10:00:00.000Z',
      brainHealth: { state: 'available', data: { tenantId }, },
      opportunityQueue: { state: 'available', data: [] },
      approvalQueue: { state: 'available', data: [] },
      learningStatus: { state: 'available', data: null },
      schedulerRepair: { state: 'available', data: null },
    }));
  });

  afterEach(async () => {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it('rejects non-staff users before reading any tenant data', async () => {
    ({ server, origin } = await startServer({ role: 'AGENT', tenantId: 'tenant-a' }));

    const { response, body } = await getJson(origin);

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'Chỉ quản lý mới có quyền xem Command Center của Minh.' });
    expect(getCommandCenterSummary).not.toHaveBeenCalled();
  });

  it('returns only the authenticated tenant summary and forwards that tenant to the service', async () => {
    ({ server, origin } = await startServer({ role: 'TEAM_LEAD', tenantId: 'tenant-b' }));

    const { response, body } = await getJson(origin);

    expect(response.status).toBe(200);
    expect(getCommandCenterSummary).toHaveBeenCalledOnce();
    expect(getCommandCenterSummary).toHaveBeenCalledWith('tenant-b');
    expect(body.brainHealth.data).toEqual({ tenantId: 'tenant-b' });
    expect(body.brainHealth.data.tenantId).not.toBe('tenant-a');
  });
});
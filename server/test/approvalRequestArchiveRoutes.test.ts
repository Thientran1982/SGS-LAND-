import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

const {
  approvalRequestRepository,
  recordMinhDecisionFeedbackSafely,
} = vi.hoisted(() => ({
  approvalRequestRepository: {
    archivePending: vi.fn(),
    findArchivedByTenant: vi.fn(),
    countArchivedByTenant: vi.fn(),
  },
  recordMinhDecisionFeedbackSafely: vi.fn(),
}));

vi.mock('../repositories/approvalRequestRepository', () => ({ approvalRequestRepository }));
vi.mock('../repositories/agentOutboundRepository', () => ({ agentOutboundRepository: {} }));
vi.mock('../services/minhDecisionLearningService', () => ({ recordMinhDecisionFeedbackSafely }));
vi.mock('../services/outreachAuditExportTelemetry', () => ({
  recordOutreachAuditExportFailureSafely: vi.fn(),
}));

import { createApprovalRequestRoutes } from '../routes/approvalRequestRoutes';

const approvalId = '11111111-1111-4111-8111-111111111111';
const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const operatorId = '22222222-2222-4222-8222-222222222222';

describe('approval request archive route', () => {
  let server: Server;
  let origin: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    const authenticateToken = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      (req as any).user = {
        id: operatorId,
        tenantId: req.header('x-test-tenant') || tenantId,
        role: req.header('x-test-role') || 'ADMIN',
      };
      next();
    };
    app.use('/api/approval-requests', createApprovalRequestRoutes(authenticateToken));
    await new Promise<void>(resolve => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not expose an address');
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('archives for the authenticated tenant and records Minh rejection feedback', async () => {
    approvalRequestRepository.archivePending.mockResolvedValue({
      id: approvalId,
      channel: 'MINH_PROACTIVE',
      actionType: 'REVIEW_LISTING_PRICE',
      sourceSignalId: 'source-signal-1',
    });

    const response = await fetch(`${origin}/api/approval-requests/${approvalId}/archive`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-tenant': tenantId },
      body: JSON.stringify({ reason: 'This request is no longer relevant.' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ archived: true, approval: { id: approvalId } });
    expect(approvalRequestRepository.archivePending).toHaveBeenCalledWith(
      tenantId,
      approvalId,
      operatorId,
      'This request is no longer relevant.',
    );
    expect(recordMinhDecisionFeedbackSafely).toHaveBeenCalledWith(tenantId, expect.objectContaining({
      eventKey: `approval:${approvalId}:archived`,
      outcome: 'REJECTED',
      feedbackCategory: 'OPERATOR_REJECTED',
      createdBy: operatorId,
      metadata: { hasReviewNote: true, archived: true },
    }));
  });

  it('requires an audit reason and an authorized reviewer', async () => {
    const missingReason = await fetch(`${origin}/api/approval-requests/${approvalId}/archive`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: '   ' }),
    });
    expect(missingReason.status).toBe(400);

    const forbidden = await fetch(`${origin}/api/approval-requests/${approvalId}/archive`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-role': 'AGENT' },
      body: JSON.stringify({ reason: 'Old request' }),
    });
    expect(forbidden.status).toBe(403);
    expect(approvalRequestRepository.archivePending).not.toHaveBeenCalled();
  });

  it('returns not found when the request is no longer pending', async () => {
    approvalRequestRepository.archivePending.mockResolvedValue(null);

    const response = await fetch(`${origin}/api/approval-requests/${approvalId}/archive`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'No longer relevant.' }),
    });

    expect(response.status).toBe(404);
  });

  it('returns a tenant-scoped archived history page and total to managers', async () => {
    approvalRequestRepository.findArchivedByTenant.mockResolvedValue([{
      id: approvalId,
      status: 'REJECTED',
      archiveReason: 'No longer relevant',
      archivedBy: operatorId,
      archivedByName: 'Review Manager',
      archivedAt: '2026-09-26T10:00:00.000Z',
    }]);
    approvalRequestRepository.countArchivedByTenant.mockResolvedValue(61);

    const response = await fetch(`${origin}/api/approval-requests/archived?limit=25&offset=50`, {
      headers: { 'x-test-tenant': tenantId },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      total: 61,
      limit: 25,
      offset: 50,
      items: [{ id: approvalId, status: 'REJECTED', archivedByName: 'Review Manager' }],
    });
    expect(approvalRequestRepository.findArchivedByTenant).toHaveBeenCalledWith(tenantId, 25, 50);
    expect(approvalRequestRepository.countArchivedByTenant).toHaveBeenCalledWith(tenantId);
  });

  it('does not return archived history to unauthorized roles', async () => {
    const response = await fetch(`${origin}/api/approval-requests/archived`, {
      headers: { 'x-test-role': 'AGENT' },
    });

    expect(response.status).toBe(403);
    expect(approvalRequestRepository.findArchivedByTenant).not.toHaveBeenCalled();
    expect(approvalRequestRepository.countArchivedByTenant).not.toHaveBeenCalled();
  });
});
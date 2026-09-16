import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

const { approvalRequestRepository, agentOutboundRepository } = vi.hoisted(() => ({
  approvalRequestRepository: {
    findApprovedOutreachForExport: vi.fn(),
  },
  agentOutboundRepository: {
    listAuditEventsForApproval: vi.fn(),
  },
}));

vi.mock('../repositories/approvalRequestRepository', () => ({ approvalRequestRepository }));
vi.mock('../repositories/agentOutboundRepository', () => ({ agentOutboundRepository }));
vi.mock('../services/minhDecisionLearningService', () => ({
  recordMinhDecisionFeedbackSafely: vi.fn(),
}));

import { createApprovalRequestRoutes } from '../routes/approvalRequestRoutes';

const approvalId = '11111111-1111-4111-8111-111111111111';
const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('outreach audit export route', () => {
  let server: Server;
  let origin: string;

  beforeAll(async () => {
    const app = express();
    const authenticateToken = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      const tenantId = req.header('x-test-tenant') || tenantA;
      const role = req.header('x-test-role') || 'ADMIN';
      (req as any).user = { id: 'operator-a', tenantId, role };
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

  it('exports only the tenant-scoped allowlisted audit evidence as CSV', async () => {
    approvalRequestRepository.findApprovedOutreachForExport.mockResolvedValue({ id: approvalId });
    agentOutboundRepository.listAuditEventsForApproval.mockResolvedValue([{
      approval_request_id: approvalId,
      delivery_id: '22222222-2222-4222-8222-222222222222',
      variant_id: 'email-1',
      channel: 'EMAIL',
      provider: 'BREVO',
      event_type: 'OPERATOR_DECISION',
      created_at: new Date('2026-09-16T10:20:30.000Z'),
      lookup_status: 'DELIVERED',
      provider_event: 'delivered',
      provider_message_id: 'provider-message-123',
      decision_status: 'SENT',
      decision_note: 'Đã đối chiếu với provider',
      operator_id: 'operator-a',
      operator_name: 'Broker A',
      provider_payload: { recipient: 'must-not-export@example.com' },
    }]);

    const response = await fetch(`${origin}/api/approval-requests/${approvalId}/outreach-audit-export`, {
      headers: { 'x-test-tenant': tenantA },
    });
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('content-disposition')).toContain(`outreach-audit-${approvalId}-`);
    expect(text).toContain('Lookup time');
    expect(text).toContain('provider-message-123');
    expect(text).toContain('SENT');
    expect(text).toContain('Đã đối chiếu với provider');
    expect(text).toContain('Broker A');
    expect(text).not.toContain('must-not-export@example.com');
    expect(approvalRequestRepository.findApprovedOutreachForExport)
      .toHaveBeenCalledWith(tenantA, approvalId);
    expect(agentOutboundRepository.listAuditEventsForApproval)
      .toHaveBeenCalledWith(tenantA, approvalId);
  });

  it('does not let another tenant enumerate the approval history', async () => {
    approvalRequestRepository.findApprovedOutreachForExport.mockResolvedValue(null);

    const response = await fetch(`${origin}/api/approval-requests/${approvalId}/outreach-audit-export`, {
      headers: { 'x-test-tenant': tenantB },
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'OUTREACH_APPROVAL_NOT_FOUND' });
    expect(agentOutboundRepository.listAuditEventsForApproval).not.toHaveBeenCalled();
  });

  it('keeps the Approval Inbox role boundary for exports', async () => {
    const response = await fetch(`${origin}/api/approval-requests/${approvalId}/outreach-audit-export`, {
      headers: { 'x-test-role': 'BROKER' },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Only authorized managers can export outreach delivery history',
    });
    expect(approvalRequestRepository.findApprovedOutreachForExport).not.toHaveBeenCalled();
  });
});
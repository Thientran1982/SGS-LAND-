import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../db', () => ({
  withTenantContext: vi.fn(async (_tenantId: string, fn: (client: any) => Promise<unknown>) => fn({ query })),
}));

import {
  agentAuditRepository,
  LANDING_CLASSIFICATION_REVIEW_LABELS,
} from '../repositories/agentAuditRepository';

const tenantId = '11111111-1111-4111-8111-111111111111';
const eventId = '22222222-2222-4222-8222-222222222222';

describe('landing classification review privacy and tenant boundaries', () => {
  beforeEach(() => query.mockReset());

  it('lists only categorical classifier features and never selects raw audit payloads', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{
          audit_event_id: eventId,
          created_at: '2026-09-07T10:00:00.000Z',
          run_id: '33333333-3333-4333-8333-333333333333',
          language: 'vi',
          suspected_type: 'FALSE_NEGATIVE',
          detected: false,
          candidate: true,
          initial_intent: 'PROJECT',
          final_intent: 'PROJECT',
          draft_status: 'NOT_ATTEMPTED',
          review_label: null,
          reviewer_id: null,
          reviewed_at: null,
        }],
      })
      .mockResolvedValueOnce({ rows: [{ total: 1 }] });

    const result = await agentAuditRepository.listLandingClassificationReviews(tenantId, {
      language: 'vi',
      status: 'pending',
    });

    const listingSql = String(query.mock.calls[0][0]);
    expect(listingSql).toContain('e.tenant_id = $1');
    expect(listingSql).toContain('r.id IS NULL');
    expect(listingSql).not.toContain('SELECT *');
    expect(listingSql).not.toMatch(/SELECT\s+e\.(input_json|output_json|metadata_json)/i);
    expect(query.mock.calls[0][1][0]).toBe(tenantId);
    expect(result).toMatchObject({
      total: 1,
      reviews: [{
        auditEventId: eventId,
        language: 'vi',
        suspectedType: 'FALSE_NEGATIVE',
        reviewLabel: null,
      }],
    });
  });

  it('rejects unsupported labels before any database mutation', async () => {
    await expect(agentAuditRepository.reviewLandingClassification(
      tenantId,
      eventId,
      'UNKNOWN' as never,
      '44444444-4444-4444-8444-444444444444',
    )).rejects.toThrow('Invalid landing classification review label');
    expect(query).not.toHaveBeenCalled();
    expect(LANDING_CLASSIFICATION_REVIEW_LABELS).toEqual([
      'CONFIRMED_FALSE_NEGATIVE',
      'CONFIRMED_FALSE_POSITIVE',
      'NOT_AN_ERROR',
    ]);
  });

  it('upserts a review only for a qualifying event and returns the sanitized regression row', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ audit_event_id: eventId, label: 'CONFIRMED_FALSE_NEGATIVE', reviewer_id: '44444444-4444-4444-8444-444444444444', reviewed_at: '2026-09-07T10:01:00.000Z' }] })
      .mockResolvedValueOnce({
        rows: [{
          audit_event_id: eventId,
          created_at: '2026-09-07T10:00:00.000Z',
          run_id: null,
          language: 'en',
          suspected_type: 'FALSE_NEGATIVE',
          detected: false,
          candidate: true,
          initial_intent: 'PROJECT',
          final_intent: 'PROJECT',
          draft_status: 'NOT_ATTEMPTED',
          review_label: 'CONFIRMED_FALSE_NEGATIVE',
          reviewer_id: '44444444-4444-4444-8444-444444444444',
          reviewed_at: '2026-09-07T10:01:00.000Z',
        }],
      });

    const review = await agentAuditRepository.reviewLandingClassification(
      tenantId,
      eventId,
      'CONFIRMED_FALSE_NEGATIVE',
      '44444444-4444-4444-8444-444444444444',
    );

    expect(query.mock.calls[0][0]).toContain('e.tenant_id = $1');
    expect(query.mock.calls[0][0]).toContain('ON CONFLICT (tenant_id, audit_event_id) DO UPDATE');
    expect(query.mock.calls[0][1]).toEqual([
      tenantId,
      eventId,
      'CONFIRMED_FALSE_NEGATIVE',
      '44444444-4444-4444-8444-444444444444',
    ]);
    expect(review).toMatchObject({
      auditEventId: eventId,
      reviewLabel: 'CONFIRMED_FALSE_NEGATIVE',
      language: 'en',
    });
  });
});
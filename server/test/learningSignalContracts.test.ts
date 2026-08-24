import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../db', () => ({
  withTenantContext: vi.fn(async (_tenantId: string, fn: (client: any) => Promise<unknown>) =>
    fn({ query }),
  ),
}));

import { agentMemoryService } from '../services/agentMemoryService';

const tenantId = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';

function insertedSignal(id: string, signalType: string, dedupeKey: string) {
  return {
    id,
    tenant_id: tenantId,
    signal_type: signalType,
    subject_type: 'fixture',
    subject_id: 'fixture-id',
    dedupe_key: dedupeKey,
  };
}

function arrangeSignalInsert(row: any, duplicateRow = row) {
  query.mockResolvedValueOnce({ rows: [row] });
  query.mockResolvedValueOnce({ rows: [] });
  query.mockResolvedValueOnce({ rows: [] });
  query.mockResolvedValueOnce({ rows: [duplicateRow] });
}

describe('learning signal contracts', () => {
  beforeEach(() => query.mockReset());

  it.each([
    ['advisor choice', 'match_chosen', 'project', 'project-1', 'match_chosen:advisor:project-1:buyer-1',
      { action: 'choose_project', source: 'property_advisor' }],
    ['lead assignment', 'match_chosen', 'lead', 'lead-1', 'match_chosen:lead_assigned:lead-1:agent-2',
      { action: 'assign_lead', assignedTo: 'agent-2' }],
    ['paid booking', 'match_chosen', 'booking', 'booking-1', 'match_chosen:booking_paid:booking-1',
      { action: 'book', listingId: 'listing-1' }],
    ['verified valuation feedback', 'price_estimate_edit_distance', 'valuation', 'valuation-1',
      'price_estimate_edit_distance:valuation:valuation-1',
      { estimatedPrice: 2_000_000_000, actualPrice: 2_200_000_000 }],
  ])('%s produces one tenant-scoped signal and replay is deduplicated',
    async (_name, signalType, subjectType, subjectId, dedupeKey, payload) => {
      const row = insertedSignal('signal-1', signalType, dedupeKey);
      arrangeSignalInsert(row);

      const first = await agentMemoryService.recordSignal(tenantId, {
        signalType,
        actorId,
        subjectType,
        subjectId,
        dedupeKey,
        provenance: signalType === 'price_estimate_edit_distance' ? 'staff_verified' : 'staff',
        payload,
      });
      const replay = await agentMemoryService.recordSignal(tenantId, {
        signalType, actorId, subjectType, subjectId, dedupeKey, payload,
      });

      expect(first).toEqual(row);
      expect(replay).toEqual(row);
      const inserts = query.mock.calls.filter(([sql]) =>
        String(sql).includes('INSERT INTO agent_signals'),
      );
      expect(inserts).toHaveLength(2);
      expect(inserts[0][1][1]).toBe(tenantId);
      expect(inserts[0][1][7]).toBe(dedupeKey);
      expect(query.mock.calls.filter(([sql]) =>
        String(sql).includes('INSERT INTO ai_learning_audit_events'),
      )).toHaveLength(1);
    });

  it('advisor choice keeps the buyer provenance and matching factors', async () => {
    const row = insertedSignal('signal-advisor', 'match_chosen', 'match_chosen:advisor:project-1:buyer-1');
    arrangeSignalInsert(row);

    await agentMemoryService.recordSignal(tenantId, {
      signalType: 'match_chosen',
      actorId: 'buyer-1',
      subjectType: 'project',
      subjectId: 'project-1',
      dedupeKey: 'match_chosen:advisor:project-1:buyer-1',
      provenance: 'buyer',
      payload: { action: 'choose_project', factors: { location: true, price: true } },
    });

    expect(query.mock.calls[0][1][8]).toBe('buyer');
    expect(query.mock.calls[0][1][6]).toContain('"location":true');
  });

  it.each(['PENDING', 'FAILED'])(
    'does not record a positive contact signal when delivery is %s',
    async deliveryStatus => {
      const result = await agentMemoryService.recordSuccessfulContactSignal(tenantId, {
        deliveryStatus,
        actorId,
        subjectId: 'lead-1',
        channel: 'ZALO',
        dedupeKey: 'match_chosen:interaction:lead-1:zalo:hello',
      });

      expect(result).toBeNull();
      expect(query).not.toHaveBeenCalled();
    },
  );

  it('records exactly one positive contact signal after SENT delivery', async () => {
    const row = insertedSignal('signal-contact', 'match_chosen', 'match_chosen:interaction:lead-1:zalo:hello');
    arrangeSignalInsert(row);

    const result = await agentMemoryService.recordSuccessfulContactSignal(tenantId, {
      deliveryStatus: 'SENT',
      actorId,
      subjectId: 'lead-1',
      channel: 'ZALO',
      dedupeKey: 'match_chosen:interaction:lead-1:zalo:hello',
    });

    expect(result).toEqual(row);
    expect(query.mock.calls[0][1][1]).toBe(tenantId);
    expect(query.mock.calls[0][1][6]).toContain('"action":"contact"');
  });
});
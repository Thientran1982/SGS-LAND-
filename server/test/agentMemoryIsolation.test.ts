import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../db', () => ({
  withTenantContext: vi.fn(async (_tenantId: string, fn: (client: any) => Promise<unknown>) =>
    fn({ query }),
  ),
}));

import { agentMemoryService } from '../services/agentMemoryService';

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';

function callsForTable(table: string) {
  return query.mock.calls.filter(([sql]) => String(sql).includes(table));
}

describe('admin agent memory tenant and privacy boundaries', () => {
  beforeEach(() => query.mockReset());

  it('scopes every admin memory query and conflict lookup to the active tenant', async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          { id: 'a-memory', tenant_id: tenantA, namespace: 'customer:a', key: 'preference', kind: 'fact', value: 'A', importance: 0.8 },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ entity_id: 'a-memory', metrics_json: {} }] });

    const result = await agentMemoryService.listAdminMemory(tenantA, {
      namespace: 'customer:a',
      kind: 'fact',
      importance: 'HIGH',
    });

    const memoryQuery = callsForTable('agent_store')[0];
    const auditQuery = callsForTable('ai_learning_audit_events')[0];
    expect(memoryQuery[0]).toContain('tenant_id=$1');
    expect(memoryQuery[1]).toEqual([tenantA, 'customer:a', 'fact']);
    expect(auditQuery[0]).toContain('tenant_id=$1');
    expect(auditQuery[1]).toEqual([tenantA]);
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'a-memory', tenant_id: tenantA }),
    ]));
    expect(result.every(row => row.tenant_id === tenantA)).toBe(true);
  });

  it('scrubs email, phone, identifiers and address before a new memory is persisted', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'memory-a', tenant_id: tenantA, value: '[scrubbed]' }] })
      .mockResolvedValueOnce({ rows: [] });

    await agentMemoryService.remember(
      tenantA,
      'customer:buyer-a',
      'contact',
      'Email a@example.com; phone 0912 345 678; CCCD 012345678901; số nhà: 12 Nguyễn Trãi, Hà Nội',
    );

    const insert = callsForTable('agent_store').find(([sql]) => String(sql).startsWith('INSERT'));
    expect(insert).toBeDefined();
    expect(insert?.[1][1]).toBe(tenantA);
    expect(insert?.[1][5]).toContain('[email đã ẩn]');
    expect(insert?.[1][5]).toContain('[số điện thoại đã ẩn]');
    expect(insert?.[1][5]).toContain('[mã định danh đã ẩn]');
    expect(insert?.[1][5]).toContain('[địa chỉ đã ẩn]');
    expect(insert?.[1][5]).not.toMatch(/a@example\.com|0912 345 678|012345678901|12 Nguyễn Trãi/);
  });

  it('scrubs Vietnamese full-address markers that begin with Unicode text', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'memory-vn-address', tenant_id: tenantA, value: '[scrubbed]' }] })
      .mockResolvedValueOnce({ rows: [] });

    await agentMemoryService.remember(
      tenantA,
      'customer:buyer-a',
      'address',
      'địa chỉ đầy đủ: 123 Đường Kiểm Thử Phường 1',
    );

    const insert = callsForTable('agent_store').find(([sql]) => String(sql).startsWith('INSERT'));
    expect(insert?.[1][5]).toContain('[địa chỉ đã ẩn]');
    expect(insert?.[1][5]).not.toContain('địa chỉ đầy đủ: 123 Đường Kiểm Thử Phường 1');
  });

  it('uses the session id for replay-safe customer memory and rejects empty transcripts', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'session-memory', namespace: 'customer:buyer-a', key: 'session:session-a' }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await agentMemoryService.summarizeSession(
      tenantA,
      'customer:buyer-a',
      'Khách: email a@example.com, số nhà: 12 Nguyễn Trãi, Hà Nội',
      'session-a',
    );

    expect(result).toMatchObject({ key: 'session:session-a' });
    const insert = callsForTable('agent_store').find(([sql]) => String(sql).startsWith('INSERT'));
    expect(insert?.[1][2]).toBe('customer:buyer-a');
    expect(insert?.[1][3]).toBe('session:session-a');
    expect(insert?.[1][5]).not.toContain('a@example.com');
    expect(insert?.[1][5]).not.toContain('12 Nguyễn Trãi');
    await expect(agentMemoryService.summarizeSession(tenantA, 'customer:buyer-a', '   ', 'session-empty'))
      .resolves.toBeNull();
  });

  it('scrubs PII on update and keeps the update tenant-scoped', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'memory-a', tenant_id: tenantA, kind: 'fact', importance: 0.3 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'memory-a', tenant_id: tenantA, value: '[scrubbed]' }] })
      .mockResolvedValueOnce({ rows: [] });

    await agentMemoryService.updateMemory(tenantA, 'memory-a', {
      namespace: 'customer:buyer-a',
      key: 'address',
      value: 'address: 99 Lê Lợi, phone 0987654321',
    });

    const select = query.mock.calls[0];
    expect(select[0]).toContain('tenant_id=$1 AND id=$2');
    expect(select[1]).toEqual([tenantA, 'memory-a']);
    const insert = callsForTable('agent_store').find(([sql]) => String(sql).startsWith('INSERT'));
    expect(insert?.[1][1]).toBe(tenantA);
    expect(insert?.[1][5]).not.toContain('99 Lê Lợi');
    expect(insert?.[1][5]).not.toContain('0987654321');
  });

  it('does not silently overwrite a high-importance fact and records a tenant audit event', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 'important-a', tenant_id: tenantA, kind: 'fact', value: 'old', importance: 0.9 }],
    });
    query.mockResolvedValueOnce({ rows: [] });

    const result = await agentMemoryService.remember(tenantA, 'agent:assistant', 'policy', 'new', 'fact', 0.2);

    expect(result).toMatchObject({ id: 'important-a', conflict: true });
    expect(callsForTable('agent_store').some(([sql]) => String(sql).startsWith('INSERT'))).toBe(false);
    const audit = callsForTable('ai_learning_audit_events')[0];
    expect(audit[1][0]).toBe(tenantA);
    expect(audit[0]).toContain('high_importance_fact_not_overwritten');
  });

  it('rejects promotion before any database mutation when the golden-set gate fails', async () => {
    await expect(agentMemoryService.promoteWeights(tenantA, 'draft-a', false, 'admin-a'))
      .rejects.toThrow('Golden-set gate');
    expect(query).not.toHaveBeenCalled();
  });

  it('cannot promote a draft from another tenant', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(agentMemoryService.promoteWeights(tenantA, 'draft-b', true, 'admin-a'))
      .resolves.toBeNull();
    expect(query.mock.calls[0][0]).toContain('tenant_id=$1 AND id=$2 AND status=\'draft\'');
    expect(query.mock.calls[0][1]).toEqual([tenantA, 'draft-b']);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('expands Vietnamese real-estate synonyms and keeps importance as the score tie-breaker', async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          { id: 'low', key: 'purpose', value: 'Mục đích an cư', importance: 0.2 },
          { id: 'high', key: 'purpose', value: 'Mục đích an cư', importance: 0.9 },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await agentMemoryService.recall(tenantA, 'customer:buyer-a', 'nhà ở gia đình', 2);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('high');
  });
});
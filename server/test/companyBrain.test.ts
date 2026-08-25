import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../db', () => ({
  withTenantContext: vi.fn(async (_tenantId: string, fn: (client: any) => Promise<unknown>) => fn({ query })),
}));

import { companyBrainRepository } from '../repositories/companyBrainRepository';
import { validateBrainDocument } from '../routes/agentOperatingRoutes';
import { canonicalizeMigrationVersions } from '../migrations/runner';

describe('Company Brain governance', () => {
  beforeEach(() => query.mockReset());

  it('validates a complete document and rejects unsafe shapes', () => {
    expect(validateBrainDocument({
      documentType: 'brand_voice',
      documentKey: 'tone',
      content: { tone: 'thân thiện' },
      source: 'company handbook',
      verificationStatus: 'unverified',
    })).toBeNull();
    expect(validateBrainDocument({
      documentType: 'unknown',
      documentKey: 'tone',
      content: {},
      source: 'internal',
    })).toContain('documentType');
    expect(validateBrainDocument({
      documentType: 'brand_voice',
      documentKey: 'tone',
      content: [],
      source: 'internal',
    })).toContain('content');
  });

  it('updates documents only through the active tenant context', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'brain-a', documentKey: 'tone' }] });
    const result = await companyBrainRepository.update('tenant-a', 'brain-a', {
      documentType: 'brand_voice',
      documentKey: 'tone',
      content: { tone: 'rõ ràng' },
      source: 'handbook',
      verificationStatus: 'unverified',
    }, 'admin-a');
    expect(result).toEqual({ id: 'brain-a', documentKey: 'tone' });
    expect(query.mock.calls[0][0]).toContain('WHERE tenant_id=$1 AND id=$2');
    expect(query.mock.calls[0][1][0]).toBe('tenant-a');
  });

  it('treats renamed historical migration records as canonical without deleting them', () => {
    expect([...canonicalizeMigrationVersions([
      '106_followup_sequences.ts',
      '106_sequence_enrollment_unique.ts',
      '171_marketing_growth_company_brain.ts',
    ])]).toEqual([
      '106_sequence_enrollment_unique.ts',
      '171_marketing_growth_company_brain.ts',
    ]);
  });
});
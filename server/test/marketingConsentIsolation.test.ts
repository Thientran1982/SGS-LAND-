import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../db', () => ({
  pool: { query },
  withTenantContext: vi.fn(async (_tenantId: string, fn: (client: any) => Promise<unknown>) =>
    fn({ query }),
  ),
}));

import { LeadRepository } from '../repositories/leadRepository';
import { UserRepository } from '../repositories/userRepository';

describe('marketing consent tenant isolation', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('updates a user only when the id belongs to the active tenant', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        id: 'user-a',
        tenant_id: 'tenant-a',
        marketing_email_consent: true,
        marketing_email_consent_at: new Date(),
        marketing_email_consent_source: 'crm',
      }],
    });

    const result = await new UserRepository().update('tenant-a', 'user-a', {
      marketingEmailConsent: true,
      marketingEmailConsentAt: '2026-08-21T00:00:00.000Z',
      marketingEmailConsentSource: 'crm',
    });

    expect(result).not.toBeNull();
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('tenant_id = current_setting(\'app.current_tenant_id\', true)::uuid');
    expect(params[0]).toBe('user-a');
    expect(sql).not.toMatch(/WHERE id = \$1 RETURNING/);
  });

  it('updates a lead only when the id belongs to the active tenant', async () => {
    query.mockResolvedValueOnce({ rows: [{ assigned_to: 'admin-a' }] });
    query.mockResolvedValueOnce({
      rows: [{
        id: 'lead-a',
        tenant_id: 'tenant-a',
        marketing_email_consent: true,
        marketing_email_consent_at: new Date(),
        marketing_email_consent_source: 'crm',
      }],
    });

    const result = await new LeadRepository().update(
      'tenant-a',
      'lead-a',
      {
        marketingEmailConsent: true,
        marketingEmailConsentAt: new Date(),
        marketingEmailConsentSource: 'crm',
      },
      'admin-a',
      'ADMIN',
    );

    expect(result).not.toBeNull();
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('tenant_id = current_setting(\'app.current_tenant_id\', true)::uuid');
    expect(params[0]).toBe('lead-a');
  });
});
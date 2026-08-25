import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, withTenantContext, withRlsBypass } = vi.hoisted(() => ({
  query: vi.fn(),
  withTenantContext: vi.fn(async (_tenantId: string, fn: (client: any) => Promise<unknown>) =>
    fn({ query }),
  ),
  withRlsBypass: vi.fn(async (fn: (client: any) => Promise<unknown>) => fn({ query })),
}));

vi.mock('../db', () => ({ withTenantContext, withRlsBypass }));

import { publicProjectContentRepository } from '../repositories/publicProjectContentRepository';

describe('public project content repository tenant and publication boundaries', () => {
  beforeEach(() => {
    query.mockReset();
    withTenantContext.mockClear();
    withRlsBypass.mockClear();
  });

  it('lists only published rows through the explicit public publication query', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        id: 'project-a',
        tenant_id: 'tenant-a',
        slug: 'project-a',
        status: 'PUBLISHED',
      }],
    });

    const result = await publicProjectContentRepository.findPublished();

    expect(result).toEqual([{
      id: 'project-a',
      tenantId: 'tenant-a',
      slug: 'project-a',
      status: 'PUBLISHED',
    }]);
    expect(withRlsBypass).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE status = 'PUBLISHED'"),
      [100],
    );
  });

  it('scopes list and detail reads to the requested tenant and id', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'project-a', tenant_id: 'tenant-a' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'project-a', tenant_id: 'tenant-a' }] });

    const list = await publicProjectContentRepository.findForTenant('tenant-a');
    const detail = await publicProjectContentRepository.findForTenant('tenant-a', 'project-a');

    expect(list).toEqual([{ id: 'project-a', tenant_id: 'tenant-a' }]);
    expect(detail).toEqual({ id: 'project-a', tenant_id: 'tenant-a' });
    expect(withTenantContext).toHaveBeenNthCalledWith(1, 'tenant-a', expect.any(Function));
    expect(withTenantContext).toHaveBeenNthCalledWith(2, 'tenant-a', expect.any(Function));
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('WHERE tenant_id = $1'),
      ['tenant-a'],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('WHERE tenant_id = $1 AND id = $2'),
      ['tenant-a', 'project-a'],
    );
  });

  it('uses tenant-scoped parameters for create and preserves publication status input', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 'project-a', tenant_id: 'tenant-a', status: 'PUBLISHED' }],
    });

    const result = await publicProjectContentRepository.create(
      'tenant-a',
      'user-a',
      { slug: 'project-a', name: 'Project A', content: { hero: 'Hello' }, status: 'PUBLISHED' },
    );

    expect(result).toEqual({ id: 'project-a', tenant_id: 'tenant-a', status: 'PUBLISHED' });
    expect(query.mock.calls[0][0]).toContain('INSERT INTO public_project_contents');
    expect(query.mock.calls[0][1]).toEqual([
      'tenant-a',
      'project-a',
      'Project A',
      JSON.stringify({ hero: 'Hello' }),
      'PUBLISHED',
      'user-a',
    ]);
  });

  it('updates, publishes, unpublishes, and deletes only within the active tenant', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'project-a', status: 'PUBLISHED' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'project-a', status: 'DRAFT' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'project-a' }] });

    const published = await publicProjectContentRepository.update(
      'tenant-a', 'user-a', 'project-a', { status: 'PUBLISHED' },
    );
    const draft = await publicProjectContentRepository.update(
      'tenant-a', 'user-a', 'project-a', { status: 'DRAFT' },
    );
    const removed = await publicProjectContentRepository.remove('tenant-a', 'project-a');

    expect(published).toEqual({ id: 'project-a', status: 'PUBLISHED' });
    expect(draft).toEqual({ id: 'project-a', status: 'DRAFT' });
    expect(removed).toBe(true);
    expect(query.mock.calls[0][0]).toContain('WHERE tenant_id = $1 AND id = $7');
    expect(query.mock.calls[0][1]).toEqual([
      'tenant-a', 'user-a', null, null, null, 'PUBLISHED', 'project-a',
    ]);
    expect(query.mock.calls[1][1]).toEqual([
      'tenant-a', 'user-a', null, null, null, 'DRAFT', 'project-a',
    ]);
    expect(query.mock.calls[2][0]).toContain('WHERE tenant_id = $1 AND id = $2');
    expect(query.mock.calls[2][1]).toEqual(['tenant-a', 'project-a']);
  });
});
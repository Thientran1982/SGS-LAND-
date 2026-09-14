import { describe, expect, it, vi } from 'vitest';
import migration from '../migrations/199_normalize_project_social_images';

describe('project social image normalization migration', () => {
  it('fills only projects that have a non-empty metadata.image and no existing image', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 3, rows: [] });
    await migration.up({ query } as any);

    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('jsonb_set');
    expect(sql).toContain(`'{coverImage}'`);
    expect(sql).toContain(`metadata->>'image'`);
    expect(sql).toContain(`metadata->'coverImage'`);
    expect(sql).toContain(`metadata->'gallery'`);
    expect(sql).toContain('RETURNING id');
  });
});
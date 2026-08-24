import { describe, expect, it, vi } from 'vitest';
import { getMigrationStatus, MIGRATION_REGISTRY } from '../migrations/runner';

function fakePool(rows: Array<{ version: string }>) {
  const query = vi.fn().mockResolvedValue({ rows });
  const release = vi.fn();
  return {
    pool: { connect: vi.fn().mockResolvedValue({ query, release }) } as any,
    query,
    release,
  };
}

describe('migration status check', () => {
  it('reports missing and unexpected versions without mutating the database', async () => {
    const { pool, query, release } = fakePool([
      { version: '001_baseline_schema.ts' },
      { version: '999_removed_migration.ts' },
    ]);

    const status = await getMigrationStatus(pool);

    expect(status.missing.length).toBeGreaterThan(0);
    expect(status.missing).toContain('002_audit_logs_and_tasks.ts');
    expect(status.unexpected).toEqual(['999_removed_migration.ts']);
    expect(status.isConsistent).toBe(false);
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0][0]).toBe('SELECT version FROM schema_versions ORDER BY version');
    expect(release).toHaveBeenCalledOnce();
  });

  it('compares the complete registry rather than only the latest version', async () => {
    const { pool } = fakePool(Object.keys(MIGRATION_REGISTRY).map((version) => ({ version })));

    const status = await getMigrationStatus(pool);

    expect(status.isConsistent).toBe(true);
    expect(status.missing).toEqual([]);
    expect(status.unexpected).toEqual([]);
  });

  it('does not create schema_versions when the tracking table is absent', async () => {
    const query = vi.fn().mockRejectedValue({ code: '42P01' });
    const release = vi.fn();
    const pool = {
      connect: vi.fn().mockResolvedValue({ query, release }),
    } as any;

    await expect(getMigrationStatus(pool)).rejects.toThrow('schema_versions does not exist');
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0][0]).not.toContain('CREATE TABLE');
    expect(release).toHaveBeenCalledOnce();
  });
});
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { withRlsBypass } = vi.hoisted(() => ({
  withRlsBypass: vi.fn(),
}));

vi.mock('../db', () => ({ withRlsBypass }));
vi.mock('../migrations/runner', () => ({}));

describe('listing integrity migration preview', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('counts the full affected population while capping each sample at five rows', async () => {
    const migration = (await import('../migrations/153_listing_data_integrity')).default;
    const query = vi.fn().mockResolvedValue({ rows: [{ count: 7, samples: [] }] });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await migration.report!({ query } as any);

    expect(query).toHaveBeenCalledTimes(8);
    for (const [sql] of query.mock.calls.slice(0, 7)) {
      expect(sql).toContain('COUNT(*) OVER () AS total_count');
      expect(sql).toContain('ORDER BY id');
      expect(sql).toContain('LIMIT 5');
      expect(sql).toContain('MAX(total_count)');
    }
    expect(query.mock.calls[7][0]).toContain('COUNT(*)::int AS count');
    expect(query.mock.calls[7][0]).toContain('ORDER BY id LIMIT 5');
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('transaction/status contradiction: 7 row(s)'),
    );
  });

  it('keeps every invalid field and contradictory lifecycle pair in the preview contract', async () => {
    const migration = (await import('../migrations/153_listing_data_integrity')).default;
    const query = vi.fn().mockResolvedValue({ rows: [{ count: 0, samples: [] }] });

    await migration.report!({ query } as any);

    const fieldQueries = query.mock.calls.slice(0, 7).map(([sql]) => sql as string);
    for (const field of ['status', 'transaction', 'type', 'price', 'area', 'currency', 'coordinates']) {
      expect(fieldQueries.some(sql => sql.includes(`FROM listings`) && (
        field === 'coordinates' ? sql.includes('jsonb_typeof(coordinates)') : sql.includes(field)
      ))).toBe(true);
    }

    const contradictionQuery = query.mock.calls[7][0] as string;
    expect(contradictionQuery).toContain("upper(btrim(transaction)) = 'SALE'");
    expect(contradictionQuery).toContain("upper(btrim(status)) = 'RENTED'");
    expect(contradictionQuery).toContain("upper(btrim(transaction)) = 'RENT'");
    expect(contradictionQuery).toContain("upper(btrim(status)) = 'SOLD'");
  });
});

describe('market integrity migration dry-run', () => {
  beforeEach(() => {
    withRlsBypass.mockReset();
  });

  it('reports pending SQL migrations without applying SQL or tracking them', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ exists: false }] })
      .mockResolvedValueOnce({
        rows: [{ category: 'coordinates', count: 8, samples: [] }],
      });
    withRlsBypass.mockImplementation(async (callback: (client: any) => Promise<unknown>) =>
      callback({ query }),
    );
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { runMarketMigrations } = await import('../market/db/migrate');
    const applied = await runMarketMigrations(true);

    expect(applied).toEqual([]);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toContain('to_regclass');
    expect(query.mock.calls[1][0]).toContain('GROUP BY category');
    expect(query.mock.calls[1][0]).toContain('FILTER (WHERE sample_no <= 5)');
    expect(query.mock.calls.flatMap(([sql]) => [sql]).join('\n')).not.toMatch(
      /CREATE TABLE IF NOT EXISTS market_migrations|INSERT INTO market_migrations|002_market_listing_integrity\.sql/,
    );
    expect(log).toHaveBeenCalledWith('[market:migrate] up to date, nothing to apply.');
  });

  it('does not read migration tracking rows when the tracking table is absent', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ exists: false }] })
      .mockResolvedValue({ rows: [] });
    withRlsBypass.mockImplementation(async (callback: (client: any) => Promise<unknown>) =>
      callback({ query }),
    );

    const { runMarketMigrations } = await import('../market/db/migrate');
    await runMarketMigrations(true);

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toContain('to_regclass');
    expect(query.mock.calls.slice(1).map(([sql]) => sql).join('\n'))
      .not.toContain('SELECT filename FROM market_migrations');
  });
});